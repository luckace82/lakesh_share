from django.db import models
from django.utils import timezone


class Stock(models.Model):
    """Basic stock information"""
    symbol = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    sector = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'stocks'
        ordering = ['symbol']
    
    def __str__(self):
        return self.symbol


class DailyPrice(models.Model):
    """Daily OHLCV - scraped once per day at 4 PM"""
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='daily_prices')
    date = models.DateField(db_index=True)
    
    open = models.DecimalField(max_digits=10, decimal_places=2)
    high = models.DecimalField(max_digits=10, decimal_places=2)
    low = models.DecimalField(max_digits=10, decimal_places=2)
    close = models.DecimalField(max_digits=10, decimal_places=2)
    volume = models.BigIntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'daily_prices'
        unique_together = [['stock', 'date']]
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.stock.symbol} - {self.date}"


class LivePrice(models.Model):
    """Live prices - scraped every 5 minutes"""
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='live_prices')
    
    ltp = models.DecimalField(max_digits=10, decimal_places=2)
    change = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    change_percent = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    volume = models.BigIntegerField(default=0)
    high = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    low = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    
    class Meta:
        db_table = 'live_prices'
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.stock.symbol} - Rs.{self.ltp}"