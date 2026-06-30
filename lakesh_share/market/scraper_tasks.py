import logging
from django.utils import timezone
from django.db import transaction
from decimal import Decimal
from datetime import datetime
from celery import shared_task
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def run_scrape_task(self, job_id, incremental=None):
    """Celery task for scraping stock data.

    If `incremental` is None, auto-detect: stocks that already have price data
    use a fast incremental scrape (few pages); brand-new stocks do a full scrape.
    """
    if incremental is None:
        from .models import ScrapeJob, DailyPrice
        try:
            job = ScrapeJob.objects.get(id=job_id)
            incremental = DailyPrice.objects.filter(stock=job.stock).exists()
        except Exception:
            incremental = False
    return _execute_scrape(job_id, incremental=incremental)

@shared_task(bind=True)
def ai_screener_task(self, symbols=None, sector=None, limit=10):
    """Celery task for AI-powered stock screening - screens stocks one by one"""
    from .models import Stock, AIScreeningJob
    from django.conf import settings
    import requests

    User = get_user_model()
    admin_user = User.objects.filter(is_superuser=True).first()

    # Get or create stocks
    if symbols:
        from .known_stocks import NEPSE_STOCKS
        stocks = []
        for sym in symbols:
            stock_info = next((s for s in NEPSE_STOCKS if s['symbol'] == sym), None)
            name = stock_info.get('name', sym)[:20] if stock_info else sym
            sector_name = stock_info.get('sector', '') if stock_info else ''
            stock, created = Stock.objects.get_or_create(
                symbol=sym,
                defaults={'name': name, 'sector': sector_name, 'is_active': True}
            )
            stocks.append(stock)
    else:
        queryset = Stock.objects.filter(is_active=True)
        if sector:
            queryset = queryset.filter(sector__icontains=sector)
        stocks = list(queryset[:limit])

    if not stocks:
        job = AIScreeningJob.objects.create(
            user=admin_user,
            status='failed',
            sector=sector,
            limit=limit,
            error='No stocks found'
        )
        job.completed_at = timezone.now()
        job.save()
        return {'error': 'No stocks found'}

    # Create AI screening job
    job = AIScreeningJob.objects.create(
        user=admin_user,
        status='running',
        sector=sector,
        limit=limit,
        total_stocks=len(stocks)
    )

    recommendations = []

    try:
        from .models import DailyPrice, ScrapeJob
        from datetime import timedelta
        import json
        import re

        # ------------------------------------------------------------------
        # Pre-flight: auto-scrape any stock that lacks recent price data
        # ------------------------------------------------------------------
        cutoff = timezone.now().date() - timedelta(days=7)
        for stock in stocks:
            has_data = stock.daily_prices.filter(date__gte=cutoff).exists()
            if not has_data:
                logger.info(f"{stock.symbol} has no recent data — scraping now …")
                job.current_stock = f"{stock.symbol} (scraping)"
                job.save()

                scrape_job = ScrapeJob.objects.create(
                    user=admin_user,
                    stock=stock,
                    status='pending'
                )
                try:
                    _execute_scrape(scrape_job.id, incremental=True)
                    # Refresh stock instance so indicators are visible
                    stock.refresh_from_db()
                except Exception as e:
                    logger.warning(f"Auto-scrape failed for {stock.symbol}: {e}")

        # ------------------------------------------------------------------
        # Screen each stock individually
        # ------------------------------------------------------------------
        for i, stock in enumerate(stocks):
            # Update progress
            job.current_stock = stock.symbol
            job.stocks_screened = i
            job.save()

            # Get 7 days of historical price data
            try:
                recent_prices = list(stock.daily_prices.filter(date__gte=cutoff).order_by('date').values('date', 'open', 'high', 'low', 'close', 'volume'))
            except Exception as e:
                recent_prices = []
                logger.warning(f"Could not fetch daily prices for {stock.symbol}: {e}")

            stock_info = {
                'symbol': stock.symbol,
                'name': stock.name,
                'sector': stock.sector,
                'rsi_14': stock.rsi_14,
                'ma_20': stock.ma_20,
                'ma_50': stock.ma_50,
                'price_change_pct_7d': stock.price_change_pct_7d,
                'price_change_pct_30d': stock.price_change_pct_30d,
                'recent_prices_7d': recent_prices
            }

            # Build prompt for single stock analysis
            prompt = f"""You are a stock market analyst. Analyze this stock with its 7-day historical price data and technical indicators. Predict if it will go UP or DOWN in the near future.

Stock data:
{stock_info}

Provide:
1. Direction prediction (UP/DOWN/SIDEWAYS)
2. Overall rating (BUY/SELL/HOLD)
3. Brief reasoning (1-2 sentences)
4. Risk level (LOW/MEDIUM/HIGH)

Focus on:
- Recent price momentum
- RSI levels (oversold < 30, overbought > 70)
- Moving average crossovers
- Volume trends
- Overall trend direction

Return the analysis in JSON format with this structure:
{{
  "symbol": "{stock.symbol}",
  "direction": "UP/DOWN/SIDEWAYS",
  "rating": "BUY/SELL/HOLD",
  "reasoning": "brief explanation",
  "risk_level": "LOW/MEDIUM/HIGH"
}}

Be concise and data-driven."""

            # Call Ollama API
            ollama_url = getattr(settings, 'OLLAMA_BASE_URL', 'http://localhost:11434')

            try:
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
                ai_response = response.json().get('response', '')

                # Parse AI response
                json_match = re.search(r'\{[\s\S]*\}', ai_response)
                if json_match:
                    try:
                        recommendation = json.loads(json_match.group())
                        recommendations.append(recommendation)
                    except Exception as e:
                        logger.error(f"Failed to parse AI response for {stock.symbol}: {e}")
                        # Add fallback recommendation
                        recommendations.append({
                            'symbol': stock.symbol,
                            'direction': 'SIDEWAYS',
                            'rating': 'HOLD',
                            'reasoning': 'AI analysis failed',
                            'risk_level': 'HIGH'
                        })
                else:
                    # Add fallback recommendation
                    recommendations.append({
                        'symbol': stock.symbol,
                        'direction': 'SIDEWAYS',
                        'rating': 'HOLD',
                        'reasoning': 'AI analysis failed',
                        'risk_level': 'HIGH'
                    })
            except Exception as e:
                logger.error(f"Failed to analyze {stock.symbol}: {e}")
                # Add fallback recommendation
                recommendations.append({
                    'symbol': stock.symbol,
                    'direction': 'SIDEWAYS',
                    'rating': 'HOLD',
                    'reasoning': 'AI analysis failed',
                    'risk_level': 'HIGH'
                })

        # Update final progress
        job.current_stock = None
        job.stocks_screened = len(stocks)
        job.result = {'recommendations': recommendations}
        job.status = 'completed'
        job.completed_at = timezone.now()
        job.save()

        return job.result

    except Exception as e:
        logger.error(f"AI screener task failed: {e}")
        job.status = 'failed'
        job.error = str(e)
        job.completed_at = timezone.now()
        job.save()
        return {'error': str(e)}

@shared_task(bind=True)
def scrape_single_stock_task(self, symbol, bulk_job_id=None, incremental=True):
    """Celery task to scrape a single stock - used for parallel execution"""
    from .known_stocks import NEPSE_STOCKS
    from .models import Stock, ScrapeJob, BulkScrapeJob
    from django.contrib.auth import get_user_model
    from django.db import models

    User = get_user_model()
    admin_user = User.objects.filter(is_superuser=True).first()

    try:
        # Find stock info from NEPSE_STOCKS
        stock_info = next((s for s in NEPSE_STOCKS if s['symbol'] == symbol), None)
        name = stock_info.get('name', symbol)[:20] if stock_info else symbol
        
        stock, _ = Stock.objects.get_or_create(symbol=symbol, defaults={'name': name})

        # Check if already running
        running = ScrapeJob.objects.filter(stock=stock, status__in=['pending', 'running']).exists()
        if running:
            return {'symbol': symbol, 'status': 'skipped', 'reason': 'already_running'}

        job = ScrapeJob.objects.create(
            user=admin_user,
            stock=stock,
            status='pending'
        )

        _execute_scrape(job.id, incremental=incremental)
        
        # Update bulk job progress if provided
        if bulk_job_id:
            try:
                BulkScrapeJob.objects.filter(id=bulk_job_id).update(
                    scraped_stocks=models.F('scraped_stocks') + 1,
                    current_symbol=symbol
                )
            except Exception:
                pass

        return {'symbol': symbol, 'status': 'completed', 'records': job.records_saved}

    except Exception as e:
        logger.error(f"Error scraping {symbol}: {e}")
        if bulk_job_id:
            try:
                BulkScrapeJob.objects.filter(id=bulk_job_id).update(
                    failed_stocks=models.F('failed_stocks') + 1
                )
            except Exception:
                pass
        return {'symbol': symbol, 'status': 'failed', 'error': str(e)}


@shared_task(bind=True)
def scrape_all_stocks_task(self, parallel=True, batch_size=5):
    """
    Celery task to scrape all known stocks from NEPSE_STOCKS.
    
    Args:
        parallel: If True, dispatch individual tasks for parallel execution
        batch_size: Number of concurrent scraping tasks (default 5 to avoid overloading)
    """
    from .known_stocks import NEPSE_STOCKS
    from .models import Stock, ScrapeJob, BulkScrapeJob
    from django.contrib.auth import get_user_model
    from celery import group, chord
    from django.db import models

    User = get_user_model()
    total_stocks = len(NEPSE_STOCKS)

    # Create bulk scrape job
    admin_user = User.objects.filter(is_superuser=True).first()
    bulk_job = BulkScrapeJob.objects.create(
        user=admin_user,
        status='running',
        total_stocks=total_stocks,
        scraped_stocks=0,
        failed_stocks=0
    )

    if parallel:
        # Dispatch parallel tasks in controlled batches to avoid
        # overwhelming the system with too many Chrome instances.
        symbols = [s['symbol'] for s in NEPSE_STOCKS]

        # Split symbols into batches of batch_size
        batches = [
            symbols[i:i + batch_size]
            for i in range(0, len(symbols), batch_size)
        ]

        logger.info(
            f"Parallel bulk scrape: {total_stocks} stocks in {len(batches)} "
            f"batches of {batch_size}"
        )

        # Build a chord: each batch is a group, batches run sequentially via chain
        from celery import chain as celery_chain

        batch_tasks = []
        for batch in batches:
            batch_group = group(
                scrape_single_stock_task.s(symbol, bulk_job.id, True)
                for symbol in batch
            )
            batch_tasks.append(batch_group)

        # Chain all batches: batch1 → batch2 → ... (each batch's tasks run in parallel,
        # but batches run sequentially to bound concurrency)
        workflow = celery_chain(*batch_tasks)
        result = workflow.apply_async()

        # Store task ID for tracking
        bulk_job.error = f"task_chain_id:{result.id}"
        bulk_job.save()

        return {
            'bulk_job_id': bulk_job.id,
            'total': total_stocks,
            'mode': 'parallel',
            'batches': len(batches),
            'batch_size': batch_size,
            'task_chain_id': result.id
        }
    
    else:
        # Sequential mode — create ONE driver and reuse it for all stocks
        from .browser_pool import _create_driver, shutdown_pool
        import time as _time

        scraped_count = 0
        failed_count = 0
        shared_driver = None

        try:
            shared_driver = _create_driver()
            logger.info(f"Sequential bulk scrape: created single reusable driver for {total_stocks} stocks")

            for stock_data in NEPSE_STOCKS:
                try:
                    symbol = stock_data['symbol']
                    name = stock_data.get('name', symbol)[:20]
                    stock, _ = Stock.objects.get_or_create(symbol=symbol, defaults={'name': name})

                    bulk_job.current_symbol = symbol
                    bulk_job.save()

                    running = ScrapeJob.objects.filter(stock=stock, status__in=['pending', 'running']).exists()
                    if running:
                        continue

                    job = ScrapeJob.objects.create(
                        user=admin_user,
                        stock=stock,
                        status='pending'
                    )

                    _execute_scrape(job.id, incremental=True, driver=shared_driver)
                    scraped_count += 1
                    bulk_job.scraped_stocks = scraped_count
                    bulk_job.save()

                except Exception as e:
                    logger.error(f"Error scraping {stock_data}: {e}")
                    failed_count += 1
                    bulk_job.failed_stocks = failed_count
                    bulk_job.save()
                    continue
        finally:
            if shared_driver:
                try:
                    shared_driver.quit()
                except Exception:
                    pass
            shutdown_pool()

        bulk_job.status = 'completed'
        bulk_job.completed_at = timezone.now()
        bulk_job.current_symbol = ''
        bulk_job.save()

        return {
            'total': total_stocks,
            'scraped': scraped_count,
            'failed': failed_count,
            'skipped': total_stocks - scraped_count - failed_count
        }


@shared_task(bind=True)
def scrape_nepse_index_task(self, historical_days=None, force_all=False):
    """
    Celery task to scrape and save NEPSE index data.

    Flow:
      - If historical_days is given → scrape that many days and upsert all.
      - If DB is empty or force_all=True → scrape everything and bulk-insert.
      - Otherwise → scrape everything, upsert only records newer than the
        latest timestamp already in the DB (incremental update).

    All saves use bulk_create(update_conflicts=True) for speed.
    """
    from .nepse_scraper import scrape_nepse_index, scrape_nepse_index_historical
    from .models import NEPSEIndex, NEPSEInsight

    try:
        # ------------------------------------------------------------------ #
        # 1.  Decide what to scrape
        # ------------------------------------------------------------------ #
        if historical_days:
            days_to_scrape = historical_days
            incremental_cutoff = None          # upsert everything returned
        else:
            existing_count = NEPSEIndex.objects.count()
            if existing_count == 0 or force_all:
                logger.info(
                    f"DB has {existing_count} records (force_all={force_all}). "
                    "Scraping full history."
                )
                days_to_scrape = 3000
                incremental_cutoff = None
            else:
                latest = NEPSEIndex.objects.order_by('-timestamp').first()
                incremental_cutoff = latest.timestamp  # save only records NEWER than this
                days_to_scrape = 3000
                logger.info(
                    f"Incremental mode. Latest record: {incremental_cutoff}. "
                    "Will only insert records newer than that."
                )

        # ------------------------------------------------------------------ #
        # 2.  Scrape
        # ------------------------------------------------------------------ #
        data_list = scrape_nepse_index_historical(
            days=days_to_scrape,
            stop_timestamp=incremental_cutoff,
        )

        if not data_list:
            logger.error("Scraper returned no data.")
            return {'success': False, 'error': 'Scraping failed'}

        logger.info(f"Scraper returned {len(data_list)} records.")

        # ------------------------------------------------------------------ #
        # 3.  Filter (incremental mode only)
        # ------------------------------------------------------------------ #
        if incremental_cutoff is not None:
            before = len(data_list)
            data_list = [d for d in data_list if d['timestamp'] > incremental_cutoff]
            logger.info(
                f"Incremental filter: {before} → {len(data_list)} records "
                f"(kept only records after {incremental_cutoff})"
            )

        if not data_list:
            logger.info("No new records to save (DB is already up to date).")
            return {'success': True, 'created': 0, 'updated': 0, 'total': 0}

        # ------------------------------------------------------------------ #
        # 4.  Bulk upsert via bulk_create(update_conflicts=True)
        # ------------------------------------------------------------------ #
        records_to_create = [
            NEPSEIndex(
                timestamp=d['timestamp'],
                value=d['value'],
                open=d.get('open'),
                high=d.get('high'),
                low=d.get('low'),
                turnover=d.get('turnover'),
                transactions=d.get('transactions'),
                shares=d.get('shares'),
                volume=d.get('volume', 0),
                is_minute_data=d.get('is_minute_data', False),
            )
            for d in data_list
        ]

        with transaction.atomic():
            NEPSEIndex.objects.bulk_create(
                records_to_create,
                update_conflicts=True,
                unique_fields=['timestamp'],
                update_fields=[
                    'value', 'open', 'high', 'low',
                    'turnover', 'transactions', 'shares',
                    'volume', 'is_minute_data',
                ],
            )

        total_upserted = len(records_to_create)

        logger.info(f"Upserted {total_upserted} NEPSE index records.")

        # Generate insights after successful upsert
        try:
            from django.utils import timezone
            now = timezone.now()
            hour = now.hour
            is_market_closed = not (11 <= hour < 15)
            generate_nepse_insights.apply_async(args=[is_market_closed])
            logger.info("Triggered NEPSE insights generation")
        except Exception as e:
            logger.warning(f"Failed to trigger insights generation: {e}")

        return {
            'success': True,
            'upserted': total_upserted,
            'total_scraped': len(data_list),
        }

    except Exception as e:
        logger.exception(f"Error in NEPSE index scrape task: {e}")
        return {'success': False, 'error': str(e)}


@shared_task
def generate_nepse_insights(is_market_closed=False):
    """Generate AI insights for NEPSE index using 1 month data"""
    from .models import NEPSEIndex, NEPSEInsight
    from django.utils import timezone
    from datetime import timedelta
    import requests
    from django.conf import settings

    try:
        now = timezone.now()
        time_range = '1m'  # Always use 1 month for insights

        # Delete old insights of the same time range
        NEPSEInsight.objects.filter(time_range=time_range).delete()
        logger.info(f"Deleted old insights for {time_range}")

        start_time = now - timedelta(days=30)
        index_data = list(NEPSEIndex.objects.filter(
            timestamp__gte=start_time
        ).order_by('timestamp'))

        if len(index_data) < 10:
            logger.warning("Not enough data to generate NEPSE insights")
            return

        values = [float(d.value) for d in index_data]
        latest_value = values[-1]
        start_value = values[0]
        change = latest_value - start_value
        change_pct = (change / start_value) * 100 if start_value > 0 else 0

        recent_trend = "up" if len(values) >= 5 and values[-1] > values[-5] else "down"

        prompt = f"""NEPSE Index (1 month): {latest_value:.2f}, Change: {change:.2f} ({change_pct:.2f}%), Trend: {recent_trend}

Provide 1-2 sentence trading recommendation. Be concise."""

        ollama_url = getattr(settings, 'OLLAMA_BASE_URL', 'http://localhost:11434')
        response = requests.post(
            f"{ollama_url}/api/generate",
            json={'model': getattr(settings, 'OLLAMA_MODEL', 'llama3:8b'), 'prompt': prompt, 'stream': False},
            timeout=180
        )
        response.raise_for_status()
        insight_text = response.json().get('response', '')

        NEPSEInsight.objects.create(
            insight=insight_text,
            time_range=time_range,
            is_market_closed=is_market_closed
        )

        logger.info(f"Generated NEPSE insight for {time_range}")
        return {'success': True}

    except Exception as e:
        logger.error(f"Error generating NEPSE insights: {e}")
        return {'success': False, 'error': str(e)}


@shared_task(bind=True)
def cleanup_nepse_minute_data():
    """Clean up 1-minute NEPSE index data older than 1 day"""
    from .models import NEPSEIndex
    from datetime import timedelta

    try:
        now = timezone.now()
        cutoff = now - timedelta(days=1)
        deleted, _ = NEPSEIndex.objects.filter(
            is_minute_data=True,
            timestamp__lt=cutoff
        ).delete()

        logger.info(f"Cleaned up {deleted} old minute data points")
        return {'success': True, 'deleted': deleted}
    except Exception as e:
        logger.error(f"Error cleaning up NEPSE minute data: {e}")
        return {'success': False, 'error': str(e)}


@shared_task
def generate_nepse_prediction():
    """Generate NEPSE index prediction with 7-day forecast using 3 months data"""
    from .models import NEPSEIndex, NEPSEPrediction
    from datetime import timedelta
    import requests
    from django.conf import settings

    try:
        now = timezone.now()

        # Always use 3 months of data for prediction
        start_time = now - timedelta(days=90)

        index_data = list(NEPSEIndex.objects.filter(
            timestamp__gte=start_time
        ).order_by('timestamp'))

        if len(index_data) < 30:
            logger.warning("Not enough data to generate NEPSE prediction")
            return

        values = [float(d.value) for d in index_data]
        latest_value = values[-1]
        avg_value = sum(values) / len(values)
        min_value = min(values)
        max_value = max(values)
        std_dev = (sum((x - avg_value) ** 2 for x in values) / len(values)) ** 0.5

        prompt = f"""Based on NEPSE index last 3 months (90 days):
- Current: {latest_value:.2f}
- Average: {avg_value:.2f}
- Min: {min_value:.2f}
- Max: {max_value:.2f}
- Std Dev: {std_dev:.2f}

Predict the index value for each of the next 7 days. For each day, provide:
1. Predicted value
2. Upper bound (predicted + 2%)
3. Lower bound (predicted - 2%)

Return in JSON format:
{{
  "predictions": [
    {{"day": 1, "value": 1234.56, "upper": 1259.25, "lower": 1209.87}},
    {{"day": 2, "value": 1235.67, "upper": 1260.38, "lower": 1210.96}},
    ...
  ]
}}

Be concise and data-driven."""

        ollama_url = getattr(settings, 'OLLAMA_BASE_URL', 'http://localhost:11434')
        response = requests.post(
            f"{ollama_url}/api/generate",
            json={'model': getattr(settings, 'OLLAMA_MODEL', 'llama3:8b'), 'prompt': prompt, 'stream': False},
            timeout=180
        )
        response.raise_for_status()
        prediction_text = response.json().get('response', '')

        import json
        import re

        # Try to extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', prediction_text)
        if json_match:
            try:
                predictions_data = json.loads(json_match.group())
            except:
                predictions_data = {'predictions': []}
        else:
            predictions_data = {'predictions': []}

        # Save predictions to database
        from .models import NEPSEPrediction
        NEPSEPrediction.objects.filter(generated_at__lt=now - timedelta(days=1)).delete()
        
        for pred in predictions_data.get('predictions', []):
            NEPSEPrediction.objects.create(
                day=pred['day'],
                predicted_value=pred['value'],
                upper_bound=pred['upper'],
                lower_bound=pred['lower'],
                generated_at=now
            )

        logger.info(f"Generated NEPSE 7-day prediction with {len(predictions_data.get('predictions', []))} days")
        return {
            'success': True,
            'predictions_count': len(predictions_data.get('predictions', []))
        }
        
    except Exception as e:
        logger.error(f"Error generating NEPSE prediction: {e}")
        return {'success': False, 'error': str(e)}


def calculate_indicators(stock):
    """Calculate and store technical indicators for a stock"""
    from .models import DailyPrice

    daily_prices = list(stock.daily_prices.order_by('date')[:60])
    if len(daily_prices) < 30:
        return

    closes = [float(p.close) for p in daily_prices]
    volumes = [int(p.volume) for p in daily_prices]

    stock.rsi_14 = _calculate_rsi(closes)

    if len(closes) >= 20:
        stock.ma_20 = sum(closes[-20:]) / 20
    if len(closes) >= 50:
        stock.ma_50 = sum(closes[-50:]) / 50

    if len(closes) >= 7:
        stock.price_change_pct_7d = ((closes[-1] - closes[-7]) / closes[-7]) * 100
    if len(closes) >= 30:
        stock.price_change_pct_30d = ((closes[-1] - closes[-30]) / closes[-30]) * 100

    if len(volumes) >= 30:
        stock.volume_avg_30d = sum(volumes[-30:]) / 30

    stock.indicators_updated = timezone.now()
    stock.save()


def _calculate_rsi(closes, period=14):
    """Calculate RSI from close prices"""
    if len(closes) < period + 1:
        return 50.0

    gains, losses = [], []
    for i in range(1, len(closes)):
        change = closes[i] - closes[i - 1]
        gains.append(max(change, 0))
        losses.append(max(-change, 0))

    if len(gains) < period:
        return 50.0

    avg_gain = sum(gains[-period:]) / period
    avg_loss = sum(losses[-period:]) / period

    if avg_loss == 0:
        return 100.0

    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def _execute_scrape(job_id, incremental=False, driver=None):
    """Execute the actual scraping work.

    If `driver` is provided, it is reused across multiple stock scrapes.
    """
    from .models import ScrapeJob

    try:
        job = ScrapeJob.objects.get(id=job_id)
        job.status = 'running'
        job.save()

        symbol = job.stock.symbol
        logger.info(f"Starting scrape for {symbol} (incremental={incremental})")

        saved = _scrape_historical_data(symbol, incremental=incremental, driver=driver)

        job.status = 'completed'
        job.records_saved = saved
        job.completed_at = timezone.now()
        job.save()

        job.stock.last_scraped = timezone.now()
        job.stock.save()

        try:
            calculate_indicators(job.stock)
        except Exception as e:
            logger.error(f"Failed to calculate indicators for {symbol}: {e}")

        logger.info(f"Scrape completed for {symbol}: {saved} records")

    except Exception as e:
        logger.error(f"Scrape failed for job {job_id}: {e}")
        try:
            job = ScrapeJob.objects.get(id=job_id)
            job.status = 'failed'
            job.error = str(e)
            job.completed_at = timezone.now()
            job.save()
        except Exception:
            pass


def _scrape_historical_data(symbol, incremental=False, driver=None):
    """Scrape historical price data using Selenium.

    If `driver` is provided, it is reused (caller manages its lifecycle).
    If not, a driver is checked out from the BrowserPool and returned after.
    """
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from bs4 import BeautifulSoup
    import time

    from .models import DailyPrice
    from .browser_pool import get_pool

    last_scraped_date = None
    max_pages = 60
    if incremental:
        try:
            last_price = DailyPrice.objects.filter(stock__symbol=symbol).order_by('-date').first()
            if last_price:
                last_scraped_date = last_price.date
                max_pages = 5
                logger.info(f"Incremental scrape for {symbol}: last date {last_scraped_date}")
        except Exception:
            logger.warning(f"Could not get last scraped date for {symbol}, falling back to full scrape")
            max_pages = 60

    owns_driver = driver is None
    pool = None
    if owns_driver:
        pool = get_pool()
        ctx = pool.get_driver()
        driver = ctx.__enter__()

    try:
        driver.get("https://merolagani.com")
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "ctl00_AutoSuggest1_txtAutoSuggest"))
        )

        driver.execute_script(f"""
            const input = document.getElementById('ctl00_AutoSuggest1_txtAutoSuggest');
            input.value = '{symbol}';
            input.dispatchEvent(new Event('input'));
            AutoSuggest.getAutoSuggestDataByElement('Company', input);
        """)
        # Wait for autocomplete dropdown to appear (or fall back to short sleep)
        try:
            WebDriverWait(driver, 2).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div.autocomplete div, .ui-autocomplete li"))
            )
        except Exception:
            time.sleep(0.5)  # fallback if dropdown selector doesn't match

        driver.find_element(By.ID, "ctl00_lbtnSearch").click()

        try:
            WebDriverWait(driver, 2).until(EC.alert_is_present())
            driver.switch_to.alert.dismiss()
        except Exception:
            pass

        WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.ID, "navHistory"))
        ).click()

        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "table.table.table-bordered tbody tr:nth-child(2)")
            )
        )

        all_data = []
        current_page = 1

        while current_page <= max_pages:
            page_data = _scrape_page(driver)
            if page_data:
                all_data.extend(page_data)

            if _is_last_page(driver):
                break

            if not _click_next_page(driver):
                break

            current_page += 1

        return _save_price_data(symbol, all_data, incremental=incremental, last_scraped_date=last_scraped_date)

    finally:
        if owns_driver and pool is not None:
            ctx.__exit__(None, None, None)


def _scrape_page(driver):
    """Scrape current page data"""
    from bs4 import BeautifulSoup

    page_data = []
    soup = BeautifulSoup(driver.page_source, "html.parser")
    tables = [t for t in soup.select("table.table.table-bordered") if t.find("tbody")]

    if not tables:
        return page_data

    tbody = tables[-1].find("tbody")
    for row in tbody.find_all("tr")[1:]:
        cols = row.find_all("td")
        if len(cols) >= 9:
            try:
                page_data.append({
                    'date':     cols[1].text.strip(),
                    'close':    cols[2].text.strip(),
                    'change':   cols[3].text.strip(),
                    'high':     cols[4].text.strip(),
                    'low':      cols[5].text.strip(),
                    'open':     cols[6].text.strip(),
                    'quantity': cols[7].text.strip(),
                    'turnover': cols[8].text.strip(),
                })
            except Exception:
                continue

    return page_data


def _save_price_data(symbol, data, incremental=False, last_scraped_date=None):
    """Save scraped price data to database using bulk upsert."""
    from .models import Stock, DailyPrice, LivePrice

    if not data:
        return 0

    stock, _ = Stock.objects.get_or_create(symbol=symbol, defaults={'name': symbol})

    latest_record = None
    latest_date = None
    records_to_create = []

    for record in data:
        try:
            date_obj = datetime.strptime(record['date'], '%Y/%m/%d').date()

            if incremental and last_scraped_date and date_obj <= last_scraped_date:
                continue

            open_price  = _clean_decimal(record['open'])
            high_price  = _clean_decimal(record['high'])
            low_price   = _clean_decimal(record['low'])
            close_price = _clean_decimal(record['close'])
            volume      = _clean_int(record['quantity'])

            if not close_price:
                continue

            records_to_create.append(DailyPrice(
                stock=stock,
                date=date_obj,
                open=open_price or close_price,
                high=high_price or close_price,
                low=low_price or close_price,
                close=close_price,
                volume=volume or 0,
            ))

            if latest_date is None or date_obj > latest_date:
                latest_date = date_obj
                latest_record = {
                    'close':  close_price,
                    'open':   open_price  or close_price,
                    'high':   high_price  or close_price,
                    'low':    low_price   or close_price,
                    'volume': volume or 0,
                }

        except Exception as e:
            logger.warning(f"Error parsing record: {e}")
            continue

    if not records_to_create:
        return 0

    with transaction.atomic():
        DailyPrice.objects.bulk_create(
            records_to_create,
            update_conflicts=True,
            unique_fields=['stock', 'date'],
            update_fields=['open', 'high', 'low', 'close', 'volume'],
        )

    saved = len(records_to_create)

    if latest_record:
        try:
            prev = DailyPrice.objects.filter(stock=stock, date__lt=latest_date).order_by('-date').first()
            prev_close = prev.close if prev else None

            change = change_pct = Decimal('0')
            if prev_close and prev_close > 0:
                change = latest_record['close'] - prev_close
                change_pct = (change / prev_close * 100).quantize(Decimal('0.01'))

            LivePrice.objects.filter(stock=stock).delete()
            LivePrice.objects.create(
                stock=stock,
                ltp=latest_record['close'],
                change=change,
                change_percent=change_pct,
                volume=latest_record['volume'],
                high=latest_record['high'],
                low=latest_record['low'],
                timestamp=timezone.now(),
            )
            logger.info(f"Updated LivePrice for {symbol}: Rs.{latest_record['close']}")
        except Exception as e:
            logger.warning(f"Failed to update LivePrice for {symbol}: {e}")

    return saved


def _is_last_page(driver):
    """Check if on last page"""
    from selenium.webdriver.common.by import By
    try:
        btn = driver.find_element(By.XPATH, "//a[@title='Next Page']")
        return "disabled" in (btn.get_attribute("class") or "")
    except Exception:
        return True


def _click_next_page(driver):
    """Navigate to next page — waits for table content to refresh instead of fixed sleep."""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    try:
        # Capture the first data row's text before clicking
        try:
            old_first_row = driver.find_element(
                By.CSS_SELECTOR, "table.table.table-bordered tbody tr:nth-child(2)"
            ).text
        except Exception:
            old_first_row = None

        btn = WebDriverWait(driver, 5).until(
            EC.presence_of_element_located((By.XPATH, "//a[@title='Next Page']"))
        )
        onclick_js = btn.get_attribute("onclick")
        if onclick_js:
            driver.execute_script(onclick_js)
        else:
            return False

        # Wait for the table content to change (max 5s)
        try:
            WebDriverWait(driver, 5).until(
                lambda d: d.find_element(
                    By.CSS_SELECTOR, "table.table.table-bordered tbody tr:nth-child(2)"
                ).text != old_first_row
            )
        except Exception:
            pass  # Table might not have changed (last page)
        return True
    except Exception:
        return False


def _clean_decimal(value):
    if not value or value.strip().lower() in ('', 'n/a', 'na'):
        return None
    try:
        return Decimal(value.replace(',', '').replace(' ', '').strip())
    except Exception:
        return None


def _clean_int(value):
    if not value or value.strip().lower() in ('', 'n/a', 'na'):
        return 0
    try:
        return int(float(value.replace(',', '').replace(' ', '').strip()))
    except Exception:
        return 0


# Automatic NEPSE Index Scraping Tasks
# -----------------------------------------

@shared_task(bind=True)
def auto_scrape_nepse_index(self):
    """
    Automatically scrape NEPSE index data daily.
    This task is scheduled to run at 4:30 PM daily.
    Delegates to scrape_nepse_index_task which handles the actual scraping.
    """
    try:
        result = scrape_nepse_index_task.delay()
        logger.info(f"Triggered NEPSE index scrape task: {result.id}")
        return {'status': 'success', 'task_id': result.id}
    except Exception as e:
        logger.error(f"Auto NEPSE index scraping failed: {e}")
        return {'status': 'failed', 'reason': str(e)}


@shared_task(bind=True)
def update_stock_indicators(self):
    """
    Update technical indicators for all stocks after market close.
    This task runs at 5:00 PM daily.
    """
    from .models import Stock, DailyPrice
    from django.utils import timezone
    import logging
    import pandas as pd
    
    logger = logging.getLogger(__name__)
    
    try:
        updated_count = 0
        stocks = Stock.objects.filter(is_active=True, daily_prices__isnull=False).distinct()
        
        for stock in stocks:
            try:
                # Get last 50 days of price data for indicator calculations
                prices = stock.daily_prices.order_by('-date')[:50]
                if len(prices) < 14:  # Need at least 14 days for RSI
                    continue
                
                # Convert to DataFrame
                df = pd.DataFrame(list(prices.values('date', 'close', 'volume')))
                df = df.sort_values('date')
                
                # Calculate RSI (14-day)
                if len(df) >= 14:
                    delta = df['close'].diff()
                    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
                    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
                    rs = gain / loss
                    rsi = 100 - (100 / (1 + rs))
                    stock.rsi_14 = rsi.iloc[-1] if not rsi.empty else None
                
                # Calculate Moving Averages
                if len(df) >= 50:
                    stock.ma_20 = df['close'].rolling(window=20).mean().iloc[-1]
                    stock.ma_50 = df['close'].rolling(window=50).mean().iloc[-1]
                elif len(df) >= 20:
                    stock.ma_20 = df['close'].rolling(window=20).mean().iloc[-1]
                
                # Calculate price changes
                if len(df) >= 30:
                    price_30d_ago = df['close'].iloc[-30]
                    price_7d_ago = df['close'].iloc[-7] if len(df) >= 7 else df['close'].iloc[0]
                    current_price = df['close'].iloc[-1]
                    
                    stock.price_change_pct_30d = ((current_price - price_30d_ago) / price_30d_ago) * 100
                    stock.price_change_pct_7d = ((current_price - price_7d_ago) / price_7d_ago) * 100
                
                # Calculate average volume
                if len(df) >= 30:
                    stock.volume_avg_30d = df['volume'].tail(30).mean()
                
                stock.indicators_updated = timezone.now()
                stock.save()
                updated_count += 1
                
            except Exception as e:
                logger.warning(f"Failed to update indicators for {stock.symbol}: {e}")
                continue
        
        logger.info(f"Updated technical indicators for {updated_count} stocks")
        return {'status': 'success', 'updated_count': updated_count}
        
    except Exception as e:
        logger.error(f"Stock indicators update failed: {e}")
        return {'status': 'failed', 'reason': str(e)}


@shared_task(bind=True)
def generate_daily_insights(self):
    """
    Generate daily market insights and analysis.
    This task runs at 5:15 PM daily.
    Delegates to the generate_nepse_insights Celery task.
    """
    try:
        result = generate_nepse_insights.apply_async(args=[False], queue='ai')
        logger.info(f"Triggered daily NEPSE insights generation: {result.id}")
        return {'status': 'success', 'task_id': result.id}
    except Exception as e:
        logger.error(f"Daily insights generation failed: {e}")
        return {'status': 'failed', 'reason': str(e)}