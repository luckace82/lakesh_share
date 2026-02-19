from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from market.scraper import ShareSansarScraper
from market.models import Stock, DailyPrice, LivePrice


class Command(BaseCommand):
    help = 'Scrape market data from ShareSansar'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Limit number of stocks to scrape'
        )
    
    def handle(self, *args, **options):
        self.stdout.write('Starting scrape...')
        
        scraper = ShareSansarScraper()
        data = scraper.scrape_market_data()
        
        if not data:
            self.stdout.write(self.style.ERROR('No data scraped'))
            return
        
        self.stdout.write(f'Scraped {len(data)} stocks')
        
        # Apply limit if specified
        limit = options['limit']
        if limit:
            data = data[:limit]
            self.stdout.write(f'Processing first {limit} stocks')
        
        # Save to database
        saved = 0
        with transaction.atomic():
            for stock_data in data:
                try:
                    # Create or get stock
                    stock, created = Stock.objects.get_or_create(
                        symbol=stock_data['symbol'],
                        defaults={'name': stock_data['symbol']}
                    )
                    
                    # Create or update daily price
                    DailyPrice.objects.update_or_create(
                        stock=stock,
                        date=timezone.now().date(),
                        defaults={
                            'open': stock_data.get('open') or stock_data['ltp'],
                            'high': stock_data.get('high') or stock_data['ltp'],
                            'low': stock_data.get('low') or stock_data['ltp'],
                            'close': stock_data['ltp'],
                            'volume': stock_data.get('volume', 0) or 0,
                        }
                    )
                    
                    # Create live price
                    LivePrice.objects.create(
                        stock=stock,
                        ltp=stock_data['ltp'],
                        change=stock_data.get('change', 0) or 0,
                        change_percent=stock_data.get('change_percent', 0) or 0,
                        volume=stock_data.get('volume', 0) or 0,
                        high=stock_data.get('high'),
                        low=stock_data.get('low'),
                    )
                    
                    saved += 1
                    self.stdout.write(f'  ✓ {stock.symbol}')
                    
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'  ✗ {stock_data["symbol"]}: {e}')
                    )
        
        self.stdout.write(
            self.style.SUCCESS(f'\nSaved {saved}/{len(data)} stocks')
        )