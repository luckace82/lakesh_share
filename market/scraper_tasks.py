import logging
from django.utils import timezone
from django.db import transaction
from decimal import Decimal
from datetime import datetime
from celery import shared_task
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def run_scrape_task(self, job_id):
    """Celery task for scraping stock data"""
    return _execute_scrape(job_id)

@shared_task(bind=True)
def scrape_all_stocks_task(self):
    """Celery task to scrape all known stocks from NEPSE_STOCKS (limited to 1 year of data)"""
    from .known_stocks import NEPSE_STOCKS
    from .models import Stock, ScrapeJob, BulkScrapeJob

@shared_task(bind=True)
def ai_screener_task(self, symbols=None, sector=None, limit=10):
    """Celery task for AI-powered stock screening - screens stocks one by one"""
    from .models import Stock, AIScreeningJob
    from django.conf import settings
    import requests

    User = get_user_model()
    admin_user = User.objects.filter(is_superuser=True).first()

    # Get stocks
    if symbols:
        # Get specific stocks by symbols
        stocks = list(Stock.objects.filter(
            is_active=True,
            symbol__in=symbols
        ))
    else:
        # Get stocks
        queryset = Stock.objects.filter(
            is_active=True
        )

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
        from .models import DailyPrice
        from datetime import timedelta
        import json
        import re

        # Screen each stock individually
        for i, stock in enumerate(stocks):
            # Update progress
            job.current_stock = stock.symbol
            job.stocks_screened = i
            job.save()

            # Get 7 days of historical price data
            cutoff = timezone.now().date() - timedelta(days=7)
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
                    timeout=60
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
def scrape_all_stocks_task(self):
    """Celery task to scrape all known stocks from NEPSE_STOCKS (limited to 1 year of data)"""
    from .known_stocks import NEPSE_STOCKS
    from .models import Stock, ScrapeJob, BulkScrapeJob
    from django.contrib.auth import get_user_model

    User = get_user_model()
    total_stocks = len(NEPSE_STOCKS)
    scraped_count = 0
    failed_count = 0

    # Create bulk scrape job
    admin_user = User.objects.filter(is_superuser=True).first()
    bulk_job = BulkScrapeJob.objects.create(
        user=admin_user,
        status='running',
        total_stocks=total_stocks,
        scraped_stocks=0,
        failed_stocks=0
    )

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

            _execute_scrape(job.id, incremental=True)
            scraped_count += 1
            bulk_job.scraped_stocks = scraped_count
            bulk_job.save()

        except Exception as e:
            logger.error(f"Error scraping {stock_data}: {e}")
            failed_count += 1
            bulk_job.failed_stocks = failed_count
            bulk_job.save()
            continue

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
        data_list = scrape_nepse_index_historical(days=days_to_scrape)

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
        # 4.  Upsert via bulk_create(update_conflicts=True)
        #     This is a single SQL statement — far faster than a Python loop.
        # ------------------------------------------------------------------ #
        objects = [
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

        update_fields = ['value', 'open', 'high', 'low', 'turnover',
                         'transactions', 'shares', 'volume', 'is_minute_data']

        with transaction.atomic():
            results = NEPSEIndex.objects.bulk_create(
                objects,
                update_conflicts=True,
                unique_fields=['timestamp'],       # the conflict key
                update_fields=update_fields,
            )

        # Django doesn't reliably populate created/updated flags across all
        # backends, so we report total rows processed instead.
        total_upserted = len(results)
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
            timeout=60
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
            timeout=60
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
            'predictions': predictions_data.get('predictions', []),
            'reasoning': prediction_text
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


def _execute_scrape(job_id, incremental=False):
    """Execute the actual scraping work"""
    from .models import ScrapeJob

    try:
        job = ScrapeJob.objects.get(id=job_id)
        job.status = 'running'
        job.save()

        symbol = job.stock.symbol
        logger.info(f"Starting scrape for {symbol} (incremental={incremental})")

        saved = _scrape_historical_data(symbol, incremental=incremental)

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


def _scrape_historical_data(symbol, incremental=False):
    """Scrape historical price data using Selenium"""
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from webdriver_manager.chrome import ChromeDriverManager
    from bs4 import BeautifulSoup
    import time

    from .models import DailyPrice

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

    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--disable-notifications")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=chrome_options
    )

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
        time.sleep(4)

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
            time.sleep(2)

        return _save_price_data(symbol, all_data, incremental=incremental, last_scraped_date=last_scraped_date)

    finally:
        driver.quit()


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
    """Save scraped price data to database"""
    from .models import Stock, DailyPrice, LivePrice

    if not data:
        return 0

    stock, _ = Stock.objects.get_or_create(symbol=symbol, defaults={'name': symbol})

    saved = 0
    latest_record = None
    latest_date = None

    with transaction.atomic():
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

                DailyPrice.objects.update_or_create(
                    stock=stock,
                    date=date_obj,
                    defaults={
                        'open':   open_price  or close_price,
                        'high':   high_price  or close_price,
                        'low':    low_price   or close_price,
                        'close':  close_price,
                        'volume': volume or 0,
                    }
                )
                saved += 1

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
                logger.warning(f"Error saving record: {e}")
                continue

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
    """Navigate to next page"""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    import time

    try:
        btn = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//a[@title='Next Page']"))
        )
        onclick_js = btn.get_attribute("onclick")
        if onclick_js:
            driver.execute_script(onclick_js)
            time.sleep(2)
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