"""Test command to diagnose NEPSE index scraping issues"""
from django.core.management.base import BaseCommand
from market.nepse_scraper import test_nepse_scraper


class Command(BaseCommand):
    help = 'Test NEPSE index scraper to diagnose issues'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Starting NEPSE scraper test..."))
        
        try:
            result = test_nepse_scraper()
            
            if result['current']:
                self.stdout.write(self.style.SUCCESS(f"✓ Current index: {result['current']['value']} at {result['current']['timestamp']}"))
            else:
                self.stdout.write(self.style.ERROR("✗ Failed to scrape current index"))
            
            if result['historical_count'] > 0:
                self.stdout.write(self.style.SUCCESS(f"✓ Historical data: {result['historical_count']} records"))
            else:
                self.stdout.write(self.style.ERROR("✗ No historical data scraped"))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {e}"))
            import traceback
            self.stdout.write(traceback.format_exc())
