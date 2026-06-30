from django.core.management.base import BaseCommand
from market.models import Stock
from market.known_stocks import NEPSE_STOCKS


class Command(BaseCommand):
    help = 'Remove stocks from database that are not in NEPSE_STOCKS list'

    def add_arguments(self, parser):
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Skip confirmation prompt',
        )

    def handle(self, *args, **options):
        # Get list of symbols from NEPSE_STOCKS
        valid_symbols = set(stock['symbol'] for stock in NEPSE_STOCKS)

        # Get all stocks in database
        db_stocks = Stock.objects.all()

        # Find stocks to remove
        stocks_to_remove = []
        for stock in db_stocks:
            if stock.symbol not in valid_symbols:
                stocks_to_remove.append(stock)

        if not stocks_to_remove:
            self.stdout.write(self.style.SUCCESS('No stocks to remove. Database is clean.'))
            return

        # Show what will be removed
        self.stdout.write(f'Found {len(stocks_to_remove)} stocks to remove:')
        for stock in stocks_to_remove:
            self.stdout.write(f'  - {stock.symbol} ({stock.name})')

        # Confirm before deletion unless --yes flag
        if not options['yes']:
            response = input(f'\nAre you sure you want to remove {len(stocks_to_remove)} stocks? (yes/no): ')
            if response.lower() != 'yes':
                self.stdout.write(self.style.WARNING('Operation cancelled.'))
                return

        # Delete stocks
        for stock in stocks_to_remove:
            stock.delete()

        self.stdout.write(self.style.SUCCESS(f'Successfully removed {len(stocks_to_remove)} stocks.'))
