from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.cache import cache
import logging
from .vector_search import StockVectorSearch
from .scraper_tasks import ai_screener_task
import json

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chat_query(request):
    """Smart chat endpoint with text-based stock search and on-demand data loading"""
    try:
        query = request.data.get('query', '').strip()
        if not query:
            return Response({'error': 'Query is required'}, status=400)
        
        # Step 1: Find relevant stocks using simple text search
        from .models import Stock, DailyPrice
        from django.utils import timezone
        from datetime import timedelta
        
        relevant_stocks = []
        stocks = Stock.objects.filter(is_active=True)
        
        # Simple text matching for now (can be enhanced with vector search later)
        query_lower = query.lower()
        for stock in stocks:
            match_score = 0
            if query_lower in stock.symbol.lower():
                match_score += 10
            if query_lower in stock.name.lower():
                match_score += 5
            if stock.sector and query_lower in stock.sector.lower():
                match_score += 3
            
            if match_score > 0:
                # Get latest price data
                latest_price = stock.live_prices.first()
                relevant_stocks.append({
                    'symbol': stock.symbol,
                    'name': stock.name,
                    'sector': stock.sector,
                    'similarity': match_score / 10.0,  # Normalize to 0-1
                    'live_price': {
                        'ltp': float(latest_price.ltp) if latest_price else None,
                        'change': float(latest_price.change) if latest_price else 0,
                        'change_percent': float(latest_price.change_percent) if latest_price else 0
                    } if latest_price else None,
                    'indicators': {
                        'rsi_14': stock.rsi_14,
                        'ma_20': stock.ma_20,
                        'ma_50': stock.ma_50,
                        'price_change_pct_7d': stock.price_change_pct_7d,
                        'price_change_pct_30d': stock.price_change_pct_30d
                    }
                })
        
        # Sort by similarity
        relevant_stocks.sort(key=lambda x: x['similarity'], reverse=True)
        relevant_stocks = relevant_stocks[:10]  # Top 10 results
        
        logger.info(f"Found {len(relevant_stocks)} relevant stocks for query: {query}")
        
        # Step 2: Build context for AI using the already fetched data
        context = build_ai_context(relevant_stocks, query)
        
        # Step 3: Get AI response
        ai_response = get_ai_response(query, context)
        
        return Response({
            'query': query,
            'relevant_stocks': relevant_stocks,
            'ai_response': ai_response,
            'context_used': context
        })
        
    except Exception as e:
        logger.error(f"Chat query error: {e}")
        return Response({'error': 'Failed to process query'}, status=500)

def build_ai_context(stocks, query):
    """Build rich context for AI from stock data"""
    context = {
        'query': query,
        'stocks_found': len(stocks),
        'stock_data': []
    }
    
    for stock in stocks:
        stock_context = {
            'symbol': stock['symbol'],
            'name': stock['name'],
            'sector': stock['sector'],
            'current_price': stock['live_price']['ltp'] if stock['live_price'] else None,
            'change_percent': stock['live_price']['change_percent'] if stock['live_price'] else None,
            'rsi': stock['indicators']['rsi_14'],
            'ma_20': stock['indicators']['ma_20'],
            'ma_50': stock['indicators']['ma_50'],
            'price_change_7d': stock['indicators']['price_change_pct_7d'],
            'recent_trend': 'up' if stock['indicators']['price_change_pct_7d'] and stock['indicators']['price_change_pct_7d'] > 0 else 'down',
            'similarity_score': stock['similarity']
        }
        context['stock_data'].append(stock_context)
    
    return context

def get_ai_response(query, context):
    """Get AI response using Ollama"""
    from django.conf import settings
    import requests
    
    # Build prompt
    stocks_info = "\n".join([
        f"- {stock['symbol']} ({stock['name']}): Current {stock['current_price']}, "
        f"Change {stock['change_percent']:+.2f}%, RSI {stock['rsi']}, "
        f"7-day change {stock['price_change_7d']:+.2f}%"
        for stock in context['stock_data']
    ])
    
    prompt = f"""You are a NEPSE stock market expert. Answer the user's question based on the provided stock data.

User Question: {query}

Available Stock Data:
{stocks_info}

Context: Found {context['stocks_found']} relevant stocks with similarity scores.

Provide a helpful, concise answer. If the user asks for specific stock analysis, focus on the most relevant stocks. 
If they ask for general market questions, provide an overview based on the available data.

Be conversational and informative. Include specific numbers and percentages when relevant."""

    try:
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
        return response.json().get('response', 'Sorry, I could not process your request.')
        
    except Exception as e:
        logger.error(f"AI response error: {e}")
        return "I'm having trouble connecting to my AI brain right now. Please try again."

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_search(request):
    """Simple stock search using text similarity"""
    query = request.data.get('query', '').strip()
    if not query:
        return Response({'error': 'Query is required'}, status=400)
    
    # Use simple text search for now
    from .models import Stock
    
    results = []
    stocks = Stock.objects.filter(is_active=True)
    query_lower = query.lower()
    
    for stock in stocks:
        match_score = 0
        if query_lower in stock.symbol.lower():
            match_score += 10
        if query_lower in stock.name.lower():
            match_score += 5
        if stock.sector and query_lower in stock.sector.lower():
            match_score += 3
        
        if match_score > 0:
            results.append({
                'symbol': stock.symbol,
                'name': stock.name,
                'sector': stock.sector,
                'similarity': match_score / 10.0
            })
    
    # Sort by similarity
    results.sort(key=lambda x: x['similarity'], reverse=True)
    results = results[:10]  # Top 10 results
    
    return Response({'results': results})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_details(request, symbol):
    """Get detailed stock data on-demand"""
    try:
        from .models import Stock, DailyPrice
        from django.utils import timezone
        from datetime import timedelta
        
        stock = Stock.objects.get(symbol=symbol.upper())
        
        # Get recent prices
        cutoff = timezone.now().date() - timedelta(days=30)
        daily_prices = stock.daily_prices.filter(
            date__gte=cutoff
        ).order_by('date').values('date', 'open', 'high', 'low', 'close', 'volume')
        
        # Get live price
        live_price = stock.live_prices.first()
        
        details = {
            'symbol': stock.symbol,
            'name': stock.name,
            'sector': stock.sector,
            'live_price': {
                'ltp': float(live_price.ltp),
                'change': float(live_price.change),
                'change_percent': float(live_price.change_percent),
                'volume': int(live_price.volume),
                'high': float(live_price.high),
                'low': float(live_price.low),
                'timestamp': live_price.timestamp.isoformat()
            } if live_price else None,
            'indicators': {
                'rsi_14': stock.rsi_14,
                'ma_20': stock.ma_20,
                'ma_50': stock.ma_50,
                'price_change_pct_7d': stock.price_change_pct_7d,
                'price_change_pct_30d': stock.price_change_pct_30d
            },
            'daily_prices': list(daily_prices)
        }
        
        return Response(details)
        
    except Stock.DoesNotExist:
        return Response({'error': 'Stock not found'}, status=404)
    except Exception as e:
        logger.error(f"Error getting stock details: {e}")
        return Response({'error': 'Failed to get stock details'}, status=500)
