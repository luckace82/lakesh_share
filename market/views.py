import json
import requests
import logging
from decimal import Decimal

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Q

from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Stock, DailyPrice, LivePrice, UserWatchlist, Portfolio, ScrapeJob, NEPSEIndex, NEPSEInsight, BulkScrapeJob
from .serializers import (
    RegisterSerializer, UserSerializer, StockSerializer, StockDetailSerializer,
    DailyPriceSerializer, LivePriceSerializer, WatchlistSerializer, PortfolioSerializer, ScrapeJobSerializer,
    NEPSEIndexSerializer, NEPSEInsightSerializer, BulkScrapeJobSerializer,
)
from .known_stocks import NEPSE_STOCKS
from .scraper_tasks import run_scrape_task, scrape_all_stocks_task, scrape_nepse_index_task

logger = logging.getLogger(__name__)


# ─── Auth ────────────────────────────────────────────────────────────────────

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({
            "user": UserSerializer(user).data,
            "message": "Registration successful"
        }, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


# ─── Stocks ──────────────────────────────────────────────────────────────────

class StockListView(generics.ListAPIView):
    serializer_class = StockSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        qs = Stock.objects.all()
        search = self.request.query_params.get('search', '')
        sector = self.request.query_params.get('sector', '')
        if search:
            qs = qs.filter(Q(symbol__icontains=search) | Q(name__icontains=search))
        if sector:
            qs = qs.filter(sector__icontains=sector)
        return qs


class StockDetailView(generics.RetrieveAPIView):
    serializer_class = StockDetailSerializer
    permission_classes = [AllowAny]
    lookup_field = 'symbol'

    def get_queryset(self):
        return Stock.objects.all()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Enrich with known stock info if name is just the symbol
        if instance.name == instance.symbol:
            for ks in NEPSE_STOCKS:
                if ks['symbol'] == instance.symbol:
                    instance.name = ks['name']
                    instance.sector = ks['sector']
                    instance.save(update_fields=['name', 'sector'])
                    break
        return Response(self.get_serializer(instance).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def known_stocks_view(request):
    """Return pre-defined NEPSE stock list + any DB stocks"""
    search = request.query_params.get('search', '').upper()
    
    stocks = list(NEPSE_STOCKS)
    if search:
        stocks = [s for s in stocks if search in s['symbol'] or search in s['name'].upper()]
    
    # Also include any DB stocks not in the known list
    known_symbols = {s['symbol'] for s in NEPSE_STOCKS}
    db_extra = Stock.objects.exclude(symbol__in=known_symbols)
    if search:
        db_extra = db_extra.filter(Q(symbol__icontains=search) | Q(name__icontains=search))
    
    for s in db_extra:
        stocks.append({"symbol": s.symbol, "name": s.name, "sector": s.sector})
    
    return Response(stocks)


# ─── Price History ───────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def stock_history_view(request, symbol):
    """Get historical OHLCV data for a stock"""
    symbol = symbol.upper()
    try:
        stock = Stock.objects.get(symbol=symbol)
    except Stock.DoesNotExist:
        return Response({"error": f"No data for {symbol}. Scrape it first."}, status=404)
    
    days = request.query_params.get('days', None)
    qs = stock.daily_prices.all().order_by('date')
    
    if days:
        from django.utils import timezone
        from datetime import timedelta
        cutoff = timezone.now().date() - timedelta(days=int(days))
        qs = qs.filter(date__gte=cutoff)
    
    serializer = DailyPriceSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def stock_live_view(request, symbol):
    """Get latest live price for a stock"""
    symbol = symbol.upper()
    try:
        stock = Stock.objects.get(symbol=symbol)
    except Stock.DoesNotExist:
        return Response({"error": f"No data for {symbol}"}, status=404)
    
    live = stock.live_prices.first()
    if not live:
        return Response({"error": "No live price available"}, status=404)
    
    return Response(LivePriceSerializer(live).data)


# ─── Scraping ────────────────────────────────────────────────────────────────

class TriggerScrapeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, symbol):
        symbol = symbol.upper()
        
        # Check for running job
        running = ScrapeJob.objects.filter(
            stock__symbol=symbol,
            status__in=['pending', 'running']
        ).first()
        
        if running:
            return Response(
                ScrapeJobSerializer(running).data,
                status=status.HTTP_200_OK
            )
        
        # Create stock if needed
        stock, _ = Stock.objects.get_or_create(
            symbol=symbol,
            defaults={'name': symbol}
        )
        
        # Look up known stock info
        for ks in NEPSE_STOCKS:
            if ks['symbol'] == symbol:
                stock.name = ks['name']
                stock.sector = ks['sector']
                stock.save()
                break
        
        # Create job
        job = ScrapeJob.objects.create(user=request.user, stock=stock)
        
        # Start background scrape
        run_scrape_task.delay(job.id)

        return Response(ScrapeJobSerializer(job).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def scrape_job_status_view(request, symbol):
    """Get latest scrape job status for a stock"""
    symbol = symbol.upper()
    job = ScrapeJob.objects.filter(stock__symbol=symbol).first()
    if not job:
        return Response({"error": "No scrape job found"}, status=404)
    return Response(ScrapeJobSerializer(job).data)


# ─── Watchlist ───────────────────────────────────────────────────────────────

class WatchlistListView(generics.ListCreateAPIView):
    serializer_class = WatchlistSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return UserWatchlist.objects.filter(user=self.request.user).select_related('stock')

    def perform_create(self, serializer):
        # Save the watchlist item
        watchlist = serializer.save(user=self.request.user)
        # Auto-trigger background scrape for this stock via Celery
        from .scraper_tasks import run_scrape_task
        from .models import ScrapeJob
        job = ScrapeJob.objects.create(
            user=self.request.user,
            stock=watchlist.stock,
            status='pending'
        )
        run_scrape_task.delay(job.id)


class WatchlistDeleteView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserWatchlist.objects.filter(user=self.request.user)

    def delete(self, request, symbol):
        symbol = symbol.upper()
        deleted, _ = UserWatchlist.objects.filter(
            user=request.user,
            stock__symbol=symbol
        ).delete()
        if deleted:
            return Response({"message": f"Removed {symbol} from watchlist"})
        return Response({"error": "Not in watchlist"}, status=404)


# ─── Portfolio ──────────────────────────────────────────────────────────────

class PortfolioListView(generics.ListCreateAPIView):
    serializer_class = PortfolioSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user).select_related('stock')

    def perform_create(self, serializer):
        # Save the portfolio item (user is handled by serializer from request context)
        portfolio = serializer.save()
        # Refresh from DB to ensure stock relation is loaded
        portfolio.refresh_from_db()
        # Auto-trigger background scrape for this stock via Celery
        from .scraper_tasks import run_scrape_task
        from .models import ScrapeJob
        job = ScrapeJob.objects.create(
            user=self.request.user,
            stock=portfolio.stock,
            status='pending'
        )
        run_scrape_task.delay(job.id)

    def list(self, request, *args, **kwargs):
        """Return aggregated portfolio by stock"""
        from django.db.models import Sum, Count, Avg
        from decimal import Decimal
        
        queryset = self.get_queryset()
        
        # Aggregate by stock
        aggregated = {}
        for item in queryset:
            symbol = item.stock.symbol
            if symbol not in aggregated:
                aggregated[symbol] = {
                    'stock': item.stock,
                    'total_quantity': 0,
                    'total_cost': Decimal('0'),
                    'transactions': [],
                }
            
            aggregated[symbol]['total_quantity'] += item.quantity
            aggregated[symbol]['total_cost'] += item.buy_price * item.quantity
            aggregated[symbol]['transactions'].append(item)
        
        # Create aggregated results
        results = []
        for symbol, data in aggregated.items():
            avg_buy_price = data['total_cost'] / data['total_quantity']
            
            # Create a mock portfolio object for serialization
            class AggregatedPortfolio:
                def __init__(self, stock, quantity, avg_price, transactions):
                    self.stock = stock
                    self.quantity = quantity
                    self.buy_price = avg_price
                    self.transactions = transactions
                    self.notes = f"{len(transactions)} transaction(s)"
                    self.buy_date = min(t.buy_date for t in transactions)
            
            aggregated_item = AggregatedPortfolio(
                stock=data['stock'],
                quantity=data['total_quantity'],
                avg_price=avg_buy_price,
                transactions=data['transactions']
            )
            
            serializer = PortfolioSerializer(aggregated_item, context={'request': request})
            portfolio_data = serializer.data
            portfolio_data['transactions_count'] = len(data['transactions'])
            portfolio_data['total_invested'] = float(data['total_cost'])
            results.append(portfolio_data)
        
        return Response(results)


class PortfolioDeleteView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def PortfolioTransactionsView(request, symbol):
    """Get all transactions for a specific stock"""
    try:
        stock = Stock.objects.get(symbol=symbol.upper())
        transactions = Portfolio.objects.filter(
            user=request.user,
            stock=stock
        ).order_by('buy_date')
        
        serializer = PortfolioSerializer(transactions, many=True, context={'request': request})
        return Response(serializer.data)
    except Stock.DoesNotExist:
        return Response({'error': 'Stock not found'}, status=404)


# ─── Auto-Scrape Watchlist ───────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auto_scrape_watchlist(request):
    """Trigger scrape for all stocks in user's watchlist that haven't been scraped recently"""
    from django.utils import timezone
    from datetime import timedelta
    cutoff = timezone.now() - timedelta(hours=6)
    data_freshness_cutoff = timezone.now() - timedelta(days=1)

    watchlist = UserWatchlist.objects.filter(user=request.user).select_related('stock')
    triggered = []
    for item in watchlist:
        stock = item.stock
        # Check if data exists and is fresh
        has_fresh_data = False
        if stock.last_scraped and stock.last_scraped > cutoff:
            latest_price = stock.daily_prices.order_by('-date').first()
            if latest_price and latest_price.date >= data_freshness_cutoff.date():
                has_fresh_data = True

        if has_fresh_data:
            continue

        running = ScrapeJob.objects.filter(stock=stock, status__in=['pending', 'running']).exists()
        if running:
            continue
        job = ScrapeJob.objects.create(user=request.user, stock=stock)
        run_scrape_task.delay(job.id)
        triggered.append(stock.symbol)

    return Response({'triggered': triggered, 'count': len(triggered)})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def scrape_all_stocks(request):
    """Trigger scraping of all known stocks"""
    task = scrape_all_stocks_task.delay()
    return Response({
        'message': 'Scraping all stocks initiated',
        'task_id': task.id
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def bulk_scrape_progress(request):
    """Get progress of the latest bulk scrape job"""
    job = BulkScrapeJob.objects.order_by('-started_at').first()
    if not job:
        return Response({
            'status': 'not_started',
            'total_stocks': 0,
            'scraped_stocks': 0,
            'failed_stocks': 0,
            'current_symbol': ''
        })
    return Response(BulkScrapeJobSerializer(job).data)

@api_view(['GET'])
@permission_classes([AllowAny])
def screener_view(request):
    """API endpoint for stock screener with pre-calculated indicators"""
    from .models import Stock
    from .serializers import StockSerializer

    # Get query parameters for filtering
    sector = request.query_params.get('sector')
    min_rsi = request.query_params.get('min_rsi')
    max_rsi = request.query_params.get('max_rsi')
    min_price_change_7d = request.query_params.get('min_price_change_7d')
    max_price_change_7d = request.query_params.get('max_price_change_7d')
    above_ma20 = request.query_params.get('above_ma20')
    below_ma20 = request.query_params.get('below_ma20')

    # Start with all active stocks
    queryset = Stock.objects.filter(
        is_active=True
    )

    # Apply filters
    if sector:
        queryset = queryset.filter(sector__icontains=sector)
    if min_rsi:
        queryset = queryset.filter(rsi_14__gte=float(min_rsi))
    if max_rsi:
        queryset = queryset.filter(rsi_14__lte=float(max_rsi))
    if min_price_change_7d:
        queryset = queryset.filter(price_change_pct_7d__gte=float(min_price_change_7d))
    if max_price_change_7d:
        queryset = queryset.filter(price_change_pct_7d__lte=float(max_price_change_7d))
    if above_ma20:
        queryset = queryset.filter(ma_20__isnull=False).annotate(
            price_above_ma20=models.Case(
                when=models.Q(daily_prices__date=models.F('indicators_updated__date')),  # Simplified logic
            )
        )

    serializer = StockSerializer(queryset, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auto_screener(request):
    """AI-powered stock screener using Ollama (Celery task)"""
    from .scraper_tasks import ai_screener_task

    try:
        symbols = request.data.get('symbols', [])
        sector = request.data.get('sector')
        limit = request.data.get('limit', 10)

        # Trigger Celery task
        if symbols:
            task = ai_screener_task.delay(symbols=symbols)
        else:
            task = ai_screener_task.delay(sector=sector, limit=limit)

        return Response({
            'message': 'AI screening initiated',
            'task_id': task.id
        })
    except Exception as e:
        logger.error(f"Auto screener error: {e}")
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ai_screening_progress(request):
    """Get progress of the latest AI screening job"""
    from .models import AIScreeningJob

    job = AIScreeningJob.objects.order_by('-started_at').first()
    if not job:
        return Response({
            'status': 'not_started',
            'result': None,
            'error': None
        })

    return Response({
        'status': job.status,
        'result': job.result,
        'error': job.error,
        'current_stock': job.current_stock,
        'stocks_screened': job.stocks_screened,
        'total_stocks': job.total_stocks,
        'started_at': job.started_at,
        'completed_at': job.completed_at
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def download_portfolio_report(request):
    """Generate PDF portfolio report using Playwright"""
    from django.http import HttpResponse
    from playwright.sync_api import sync_playwright
    import tempfile
    from datetime import datetime

    # Get portfolio data
    portfolio_data = request.data.get('portfolio_data', {})
    ai_insights = request.data.get('ai_insights', '')
    holdings = request.data.get('holdings', [])
    asset_allocation = request.data.get('asset_allocation', [])
    stock_contribution = request.data.get('stock_contribution', [])

    # Calculate colors for charts
    total_invested = portfolio_data.get('total_invested', 0)
    total_current = portfolio_data.get('total_current', 0)
    total_pl = portfolio_data.get('total_pl', 0)
    total_pl_pct = portfolio_data.get('total_pl_pct', 0)

    # Generate asset allocation pie chart HTML
    allocation_chart = ''
    if asset_allocation:
        colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']
        allocation_chart = '<div style="display: flex; gap: 15px; flex-wrap: wrap; margin: 20px 0; justify-content: center;">'
        for i, item in enumerate(asset_allocation):
            color = colors[i % len(colors)]
            percentage = item['value'] / total_current * 100 if total_current > 0 else 0
            allocation_chart += f'''
                <div style="text-align: center; margin: 10px;">
                    <div style="width: 70px; height: 70px; border-radius: 50%; background: {color}; margin: 0 auto 10px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"></div>
                    <div style="font-size: 13px; font-weight: bold; color: #333;">{item['name']}</div>
                    <div style="font-size: 12px; color: #666; font-weight: 600;">{percentage:.1f}%</div>
                </div>
            '''
        allocation_chart += '</div>'

    # Generate stock contribution bar chart HTML
    contribution_chart = ''
    if stock_contribution:
        # Find max contribution for scaling
        max_contribution = max(abs(item['pl']) for item in stock_contribution) if stock_contribution else 1
        contribution_chart = '<div style="margin: 20px 0;">'
        for item in stock_contribution[:10]:  # Top 10 stocks
            contribution_pct = item['pl'] / total_pl * 100 if total_pl != 0 else 0
            bar_color = '#22c55e' if item['pl'] >= 0 else '#ef4444'
            # Scale bar width relative to max contribution
            bar_width = min(100, (abs(item['pl']) / max_contribution) * 100) if max_contribution > 0 else 0
            contribution_chart += f'''
                <div style="display: flex; align-items: center; margin: 10px 0;">
                    <div style="
                        width: 70px;
                        font-size: 12px;
                        font-weight: 600;
                        color: #93c5fd;
                        letter-spacing: 0.5px;
                    ">{item['symbol']}</div>
                    <div style="flex: 1; background: #1f2937; border-radius: 6px; height: 24px; margin: 0 12px; overflow: hidden;">
                        <div style="
                            width: {bar_width}%;
                            background: linear-gradient(90deg, {bar_color}, {bar_color}cc);
                            height: 100%;
                            border-radius: 6px;
                            box-shadow: 0 0 10px rgba(0,0,0,0.2);
                            transition: width 0.3s ease;
                        "></div>
                    </div>
                    <span style="
                        background: rgba(59,130,246,0.2);
                        color: #60a5fa;
                        padding: 4px 10px;
                        border-radius: 6px;
                        font-size: 11px;
                        font-weight: 600;
                    ">
                        {contribution_pct:.1f}%
                    </span>
                </div>
            '''
        contribution_chart += '</div>'

    # Generate holdings table HTML
    holdings_table = ''
    if holdings:
        holdings_table = '''
        <table>
            <thead>
                <tr>
                    <th>Stock</th>
                    <th>Quantity</th>
                    <th>Buy Price</th>
                    <th>Current Price</th>
                    <th>P/L</th>
                    <th>P/L %</th>
                </tr>
            </thead>
            <tbody>
        '''
        for h in holdings:
            pl_color = 'green' if h['pl'] >= 0 else 'red'
            holdings_table += f'''
                <tr>
                    <td>{h['symbol']}</td>
                    <td>{h['quantity']}</td>
                    <td>NPR {h['buy_price']:.2f}</td>
                    <td>NPR {h['current_price']:.2f}</td>
                    <td style="color: {pl_color};">NPR {h['pl']:.2f}</td>
                    <td style="color: {pl_color};">{h['pl_pct']:.2f}%</td>
                </tr>
            '''
        holdings_table += '</tbody></table>'

    # Create HTML template for the report
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Portfolio Report</title>
        <style>
            body {{
                font-family: 'Inter', Arial, sans-serif;
                background: #0f172a;
                color: #e5e7eb;
                padding: 40px;
            }}

            h1 {{
                color: white;
                font-size: 28px;
                margin-bottom: 5px;
            }}

            h2 {{
                color: #cbd5e1;
                font-size: 14px;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                margin-top: 30px;
            }}

            .summary {{
                background: linear-gradient(135deg, #1e293b, #0f172a);
                border: 1px solid #334155;
                padding: 25px;
                border-radius: 16px;
                margin: 20px 0;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }}

            .summary p {{
                margin: 8px 0;
                font-size: 14px;
                color: #e2e8f0;
            }}

            .summary strong {{
                color: #38bdf8;
            }}

            .chart-section {{
                background: #111827;
                border: 1px solid #1f2937;
                border-radius: 16px;
                padding: 20px;
                margin: 20px 0;
                box-shadow: 0 8px 20px rgba(0,0,0,0.25);
            }}

            .chart-section:hover {{
                border-color: #38bdf8;
                box-shadow: 0 0 20px rgba(56,189,248,0.1);
                transition: 0.3s;
            }}

            table {{
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
                font-size: 13px;
                border-radius: 10px;
                overflow: hidden;
            }}

            th {{
                background: #1f2937;
                color: #93c5fd;
                padding: 12px;
                text-align: left;
                font-weight: 600;
            }}

            td {{
                border-bottom: 1px solid #1f2937;
                padding: 10px;
                color: #e5e7eb;
            }}

            tr:hover {{
                background: #1f2937;
            }}

            .insights {{
                background: linear-gradient(135deg, #0f172a, #1e293b);
                border: 1px solid #334155;
                padding: 20px;
                border-radius: 16px;
                margin: 20px 0;
            }}

            .footer {{
                margin-top: 40px;
                color: #64748b;
                font-size: 12px;
                text-align: center;
                border-top: 1px solid #1f2937;
                padding-top: 20px;
            }}
        </style>
    </head>
    <body>
        <h1>📊 Portfolio Report</h1>
        <p style="color: #64748b; font-size: 14px;">Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>

        <div class="summary">
            <h2 style="color:#38bdf8; margin-top:0;">� Portfolio Overview</h2>

            <p>💰 <strong>Total Invested:</strong> NPR {total_invested:,.2f}</p>
            <p>📊 <strong>Current Value:</strong> NPR {total_current:,.2f}</p>

            <p style="font-size:16px; margin-top:15px;">
                📈 <strong>Total P/L:</strong>
                <span style="color:{'#22c55e' if total_pl>=0 else '#ef4444'}">
                    NPR {total_pl:,.2f} ({total_pl_pct:.2f}%)
                </span>
            </p>
        </div>

        <div class="chart-section">
            <h2>🎯 Asset Allocation</h2>
            {allocation_chart if allocation_chart else '<p style="color: #64748b;">No allocation data available</p>'}
        </div>

        <div class="chart-section">
            <h2>📈 Stock Contribution to P/L</h2>
            {contribution_chart if contribution_chart else '<p style="color: #64748b;">No contribution data available</p>'}
        </div>

        <div class="chart-section">
            <h2>📋 Holdings Detail</h2>
            {holdings_table if holdings_table else '<p style="color: #64748b;">No holdings data available</p>'}
        </div>

        <div class="insights">
            <h2 style="color:#38bdf8;">🤖 AI Insights</h2>
            <p style="
                color:#e2e8f0;
                line-height:1.7;
                font-size:14px;
            ">
                {ai_insights if ai_insights else 'No AI insights generated'}
            </p>
        </div>

        <div class="footer">
            <p>Generated by LakeShare Portfolio Manager</p>
        </div>
    </body>
    </html>
    """

    # Generate PDF using Playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html_content)

        # Create a temporary file for the PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as pdf_file:
            pdf_path = pdf_file.name
            page.pdf(path=pdf_path, format='A4', print_background=True)

        browser.close()

    # Read the PDF and send it as response
    with open(pdf_path, 'rb') as f:
        pdf_data = f.read()

    # Clean up the temporary file
    import os
    os.unlink(pdf_path)

    response = HttpResponse(pdf_data, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="portfolio_report_{datetime.now().strftime("%Y%m%d")}.pdf"'
    return response


# ─── AI Analysis ─────────────────────────────────────────────────────────────

class AIAnalyzeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        analysis_type = request.data.get('type', 'stock')
        
        if analysis_type == 'portfolio':
            return self._analyze_portfolio(request)
        else:
            return self._analyze_stock(request)

    def _analyze_portfolio(self, request):
        from .models import Portfolio

        portfolio = Portfolio.objects.filter(user=request.user).select_related('stock')
        if not portfolio:
            return Response({'error': 'No portfolio holdings found'}, status=status.HTTP_400_BAD_REQUEST)

        # Prepare portfolio data with current prices from stock data
        holdings_data = []
        for p in portfolio:
            # Get current price from stock's latest price
            latest_price = p.stock.daily_prices.order_by('-date').first()
            current_price = float(latest_price.close) if latest_price else float(p.buy_price)

            pl = current_price * p.quantity - float(p.buy_price) * p.quantity
            pl_pct = (pl / (float(p.buy_price) * p.quantity) * 100) if p.quantity > 0 else 0

            holdings_data.append({
                'symbol': p.stock.symbol,
                'name': p.stock.name,
                'sector': p.stock.sector,
                'quantity': p.quantity,
                'buy_price': float(p.buy_price),
                'current_price': current_price,
                'pl': pl,
                'pl_pct': pl_pct
            })

        # Calculate portfolio metrics
        total_invested = sum(h['buy_price'] * h['quantity'] for h in holdings_data)
        total_current = sum(h['current_price'] * h['quantity'] for h in holdings_data)
        total_pl = total_current - total_invested
        total_pl_pct = (total_pl / total_invested * 100) if total_invested > 0 else 0

        # Calculate sector allocation
        sector_allocation = {}
        for h in holdings_data:
            sector = h['sector'] or 'Other'
            value = h['current_price'] * h['quantity']
            sector_allocation[sector] = sector_allocation.get(sector, 0) + value

        # Calculate risk metrics
        losing_stocks = sum(1 for h in holdings_data if h['pl'] < 0)
        winning_stocks = sum(1 for h in holdings_data if h['pl'] > 0)

        prompt = f"""You are a financial analyst for NEPSE (Nepal Stock Exchange). Analyze the following portfolio:

Total Invested: NPR {total_invested:,.2f}
Current Value: NPR {total_current:,.2f}
Total P/L: NPR {total_pl:,.2f} ({total_pl_pct:.2f}%)
Number of Holdings: {len(holdings_data)}
Winning Stocks: {winning_stocks}
Losing Stocks: {losing_stocks}

Holdings:
{self._format_holdings(holdings_data)}

Sector Allocation:
{self._format_sector_allocation(sector_allocation)}

Answer these questions in bullet points:
- Am I making money?
- How risky is it?
- Where is my money allocated?
- Overall recommendation: Should I HOLD, BUY more, or SELL positions?

Provide a concise, data-driven analysis in bullet points. Keep your response under 250 words."""

        try:
            ai_response = self._query_ollama(prompt)
            return Response({'analysis': ai_response})
        except Exception as e:
            logger.error(f"AI portfolio analysis error: {e}")
            return Response({'error': 'Failed to generate analysis'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _analyze_stock(self, request):
        symbol = request.data.get('symbol', '').upper()
        user_message = request.data.get('message', '')

        if not symbol:
            return Response({'error': 'Symbol is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            stock = Stock.objects.get(symbol=symbol)
        except Stock.DoesNotExist:
            return Response({'error': 'Stock not found'}, status=status.HTTP_404_NOT_FOUND)

        # Fetch recent price data
        daily_prices = stock.daily_prices.order_by('-date')[:30]
        if not daily_prices:
            return Response({'error': 'No price data available'}, status=status.HTTP_400_BAD_REQUEST)

        # Prepare context for AI
        price_data = [
            {'date': p.date, 'close': float(p.close), 'volume': int(p.volume)}
            for p in daily_prices
        ]

        context = {
            'symbol': symbol,
            'stock_name': stock.name,
            'sector': stock.sector,
            'recent_prices': price_data[:10],
            'user_question': user_message
        }

        prompt = f"""You are a financial analyst for NEPSE (Nepal Stock Exchange). Analyze the following stock data:

Symbol: {context['symbol']}
Name: {context['stock_name']}
Sector: {context['sector'] or 'N/A'}

Recent Price Data (last 10 days):
{self._format_price_data(context['recent_prices'])}

User Question: {context['user_question']}

Provide a concise, data-driven analysis. Focus on:
- Price trends
- Volume patterns
- Support/resistance levels
- Risk factors

Keep your response under 200 words."""

        try:
            ai_response = self._query_ollama(prompt)
            return Response({'analysis': ai_response})
        except Exception as e:
            logger.error(f"AI analysis error: {e}")
            return Response({'error': 'Failed to generate analysis'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _format_holdings(self, holdings):
        return '\n'.join([
            f"{h['symbol']} ({h['name']}): Qty={h['quantity']}, Buy={h['buy_price']:.2f}, Current={h['current_price']:.2f}, P/L=NPR {h['pl']:.2f} ({h['pl_pct']:.2f}%)"
            for h in holdings
        ])

    def _format_sector_allocation(self, allocation):
        total = sum(allocation.values())
        return '\n'.join([
            f"{sector}: NPR {value:,.2f} ({value/total*100:.1f}%)"
            for sector, value in allocation.items()
        ])

    def _format_price_data(self, prices):
        return '\n'.join([f"{p['date']}: Close={p['close']}, Volume={p['volume']}" for p in prices])

    def _query_ollama(self, prompt):
        ollama_url = getattr(settings, 'OLLAMA_BASE_URL', 'http://localhost:11434')
        response = requests.post(
            f"{ollama_url}/api/generate",
            json={
                'model': getattr(settings, 'OLLAMA_MODEL', 'llama3:8b'),
                'prompt': prompt,
                'stream': False
            },
            timeout=180
        )
        response.raise_for_status()
        return response.json().get('response', '')


def _calculate_rsi(closes, period=14):
    """Calculate RSI from close prices (newest first)"""
    if len(closes) < period + 1:
        return 50.0  # Default neutral

    # Reverse to oldest-first for calculation
    prices = list(reversed(closes[:period + 1]))

    gains = []
    losses = []
    for i in range(1, len(prices)):
        change = prices[i] - prices[i - 1]
        if change > 0:
            gains.append(change)
            losses.append(0)
        else:
            gains.append(0)
            losses.append(abs(change))

    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period

    if avg_loss == 0:
        return 100.0

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi


# ─── NEPSE Index ──────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def nepse_index_data(request):
    """Get NEPSE index data with time range filtering"""
    from datetime import datetime, timedelta
    from django.utils import timezone

    time_range = request.query_params.get('range', '1d')
    now = timezone.now()

    # Calculate time filter based on range
    if time_range == '1d':
        start_time = now - timedelta(days=1)
        is_minute_data = True
    elif time_range == '3d':
        start_time = now - timedelta(days=3)
        is_minute_data = True
    elif time_range == '1w':
        start_time = now - timedelta(weeks=1)
        is_minute_data = False
    elif time_range == '1m':
        start_time = now - timedelta(days=30)
        is_minute_data = False
    elif time_range == '3m':
        start_time = now - timedelta(days=90)
        is_minute_data = False
    elif time_range == '6m':
        start_time = now - timedelta(days=180)
        is_minute_data = False
    elif time_range == '1y':
        start_time = now - timedelta(days=365)
        is_minute_data = False
    elif time_range == 'all':
        start_time = timezone.now() - timedelta(days=3650)  # 10 years
        is_minute_data = False
    else:
        start_time = now - timedelta(days=1)
        is_minute_data = True

    # Fetch index data (don't filter by is_minute_data since we only have daily data)
    queryset = NEPSEIndex.objects.filter(
        timestamp__gte=start_time
    ).order_by('timestamp')

    serializer = NEPSEIndexSerializer(queryset, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def scrape_nepse_index(request):
    """Trigger NEPSE index scraping

    Query params:
        days: Number of historical days to scrape (optional, for bulk scraping)
        force_all: If True, scrape all data regardless of existing data
    """
    from .scraper_tasks import scrape_nepse_index_task

    days = request.query_params.get('days')
    force_all = request.query_params.get('force_all', '').lower() == 'true'
    
    if days:
        try:
            days = int(days)
        except ValueError:
            return Response({'error': 'days must be an integer'}, status=400)

    task = scrape_nepse_index_task.delay(historical_days=days, force_all=force_all)
    return Response({
        'message': 'NEPSE index scraping started',
        'task_id': task.id,
        'historical_days': days,
        'force_all': force_all
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def scrape_task_status(request, task_id):
    """Return the status/result of a background Celery task (e.g. NEPSE scrape)."""
    from celery.result import AsyncResult

    result = AsyncResult(task_id)
    payload = {
        'task_id': task_id,
        'state': result.state,          # PENDING / STARTED / SUCCESS / FAILURE
        'ready': result.ready(),
    }
    if result.ready():
        try:
            payload['result'] = result.result if result.successful() else str(result.result)
        except Exception:
            payload['result'] = None
    return Response(payload)


@api_view(['GET'])
@permission_classes([AllowAny])
def nepse_insights(request):
    """Get NEPSE index AI insights"""
    time_range = request.query_params.get('range', '7d')
    insights = NEPSEInsight.objects.filter(time_range=time_range).order_by('-generated_at')[:5]
    serializer = NEPSEInsightSerializer(insights, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
def generate_nepse_insights(request):
    """Trigger NEPSE insight generation"""
    from .scraper_tasks import generate_nepse_insights
    from django.utils import timezone

    try:
        now = timezone.now()
        hour = now.hour
        is_market_closed = not (11 <= hour < 15)
        generate_nepse_insights.apply_async(args=[is_market_closed])
        return Response({'success': True, 'message': 'Insights generation triggered'})
    except Exception as e:
        return Response({'success': False, 'error': str(e)}, status=500)


@api_view(['GET'])
@permission_classes([AllowAny])
def nepse_predictions(request):
    """Get NEPSE index predictions"""
    from .models import NEPSEPrediction
    from .serializers import NEPSEPredictionSerializer

    predictions = NEPSEPrediction.objects.all().order_by('day')
    serializer = NEPSEPredictionSerializer(predictions, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def nepse_index_stats(request):
    """Get NEPSE index statistics"""
    total_records = NEPSEIndex.objects.count()
    latest_record = NEPSEIndex.objects.order_by('-timestamp').first()

    data = {
        'total_records': total_records,
        'latest_timestamp': latest_record.timestamp if latest_record else None,
        'latest_value': float(latest_record.value) if latest_record else None,
    }
    return Response(data)


@api_view(['GET'])
@permission_classes([AllowAny])
def market_stats(request):
    """Get market statistics including total stocks, scraped stocks, and market status"""
    from .models import Stock, DailyPrice
    from datetime import datetime
    import pytz

    # Get total stocks in database
    total_stocks = Stock.objects.count()

    # Get stocks that have been scraped (have daily price data)
    scraped_stocks = DailyPrice.objects.values('stock_id').distinct().count()

    # Calculate market status based on Nepali time
    nepal_tz = pytz.timezone('Asia/Kathmandu')
    now_nepal = datetime.now(nepal_tz)
    current_hour = now_nepal.hour
    current_minute = now_nepal.minute
    current_time = current_hour * 60 + current_minute

    # Market is open from 11:00 to 15:00 (3:00 PM) in Nepali time
    market_open_time = 11 * 60  # 11:00 AM
    market_close_time = 15 * 60  # 3:00 PM

    is_market_open = market_open_time <= current_time < market_close_time

    data = {
        'total_stocks': total_stocks,
        'scraped_stocks': scraped_stocks,
        'is_market_open': is_market_open,
        'nepal_time': now_nepal.strftime('%H:%M'),
        'current_day': now_nepal.strftime('%A'),
    }
    return Response(data)


@api_view(['GET'])
@permission_classes([AllowAny])
def scraped_stocks_list(request):
    """Get list of stocks that have been scraped"""
    from .models import Stock, DailyPrice
    from .serializers import StockSerializer

    # Get stocks that have DailyPrice data
    scraped_stock_ids = DailyPrice.objects.values('stock_id').distinct()
    scraped_stocks = Stock.objects.filter(id__in=scraped_stock_ids).order_by('symbol')

    return Response(StockSerializer(scraped_stocks, many=True).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def all_stocks_with_prices(request):
    """Get all stocks with their latest price data"""
    from .models import Stock, DailyPrice, LivePrice
    from .serializers import StockSerializer, LivePriceSerializer

    search = request.query_params.get('search', '').upper()
    sector = request.query_params.get('sector', '')

    # Get all stocks
    stocks = Stock.objects.all()

    if search:
        stocks = stocks.filter(Q(symbol__icontains=search) | Q(name__icontains=search))
    if sector:
        stocks = stocks.filter(sector__icontains=sector)

    stocks = stocks.order_by('symbol')

    # Build response with stock data and latest price
    result = []
    for stock in stocks:
        stock_data = StockSerializer(stock).data

        # Get latest live price
        live = stock.live_prices.first()
        if live:
            stock_data['latest_price'] = LivePriceSerializer(live).data
        else:
            # Fallback to latest daily price
            latest_daily = stock.daily_prices.order_by('-date').first()
            if latest_daily:
                stock_data['latest_price'] = {
                    'ltp': latest_daily.close,
                    'change': latest_daily.close - latest_daily.open,
                    'change_percent': ((latest_daily.close - latest_daily.open) / latest_daily.open * 100) if latest_daily.open else 0,
                    'volume': latest_daily.volume,
                    'high': latest_daily.high,
                    'low': latest_daily.low,
                    'timestamp': latest_daily.date.isoformat()
                }
            else:
                stock_data['latest_price'] = None

        result.append(stock_data)

    return Response(result)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_nepse_prediction(request):
    """Generate NEPSE index prediction"""
    from .scraper_tasks import generate_nepse_prediction
    task = generate_nepse_prediction.delay()
    return Response({
        'message': 'NEPSE prediction generation started',
        'task_id': task.id
    })
