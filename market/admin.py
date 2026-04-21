from django.contrib import admin
from .models import Stock, DailyPrice, LivePrice, UserWatchlist, Portfolio, ScrapeJob


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ['symbol', 'name', 'sector', 'is_active', 'last_scraped']
    search_fields = ['symbol', 'name']


@admin.register(DailyPrice)
class DailyPriceAdmin(admin.ModelAdmin):
    list_display = ['stock', 'date', 'open', 'high', 'low', 'close', 'volume']
    list_filter = ['date']


@admin.register(LivePrice)
class LivePriceAdmin(admin.ModelAdmin):
    list_display = ['stock', 'ltp', 'change_percent', 'volume', 'timestamp']
    list_filter = ['timestamp']


@admin.register(UserWatchlist)
class UserWatchlistAdmin(admin.ModelAdmin):
    list_display = ['user', 'stock', 'added_at']
    list_filter = ['user']


@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = ['user', 'stock', 'quantity', 'buy_price', 'buy_date']
    list_filter = ['user']


@admin.register(ScrapeJob)
class ScrapeJobAdmin(admin.ModelAdmin):
    list_display = ['stock', 'user', 'status', 'records_saved', 'started_at', 'completed_at']
    list_filter = ['status']