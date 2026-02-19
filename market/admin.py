from django.contrib import admin
from .models import Stock, DailyPrice, LivePrice


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ['symbol', 'name', 'sector', 'is_active']
    search_fields = ['symbol', 'name']


@admin.register(DailyPrice)
class DailyPriceAdmin(admin.ModelAdmin):
    list_display = ['stock', 'date', 'open', 'high', 'low', 'close', 'volume']
    list_filter = ['date']


@admin.register(LivePrice)
class LivePriceAdmin(admin.ModelAdmin):
    list_display = ['stock', 'ltp', 'change_percent', 'volume', 'timestamp']
    list_filter = ['timestamp']