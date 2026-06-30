from django.db import models
from django.conf import settings
from django.utils import timezone


class Stock(models.Model):
    """Basic stock information"""
    symbol = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    sector = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    last_scraped = models.DateTimeField(null=True, blank=True)

    # Pre-calculated technical indicators for screener
    rsi_14 = models.FloatField(null=True, blank=True, help_text="14-day RSI")
    ma_20 = models.FloatField(null=True, blank=True, help_text="20-day Moving Average")
    ma_50 = models.FloatField(null=True, blank=True, help_text="50-day Moving Average")
    price_change_pct_7d = models.FloatField(null=True, blank=True, help_text="7-day price change %")
    price_change_pct_30d = models.FloatField(null=True, blank=True, help_text="30-day price change %")
    volume_avg_30d = models.FloatField(null=True, blank=True, help_text="30-day average volume")
    indicators_updated = models.DateTimeField(null=True, blank=True, help_text="When indicators were last calculated")

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


class UserWatchlist(models.Model):
    """Per-user stock watchlist"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='watchlist')
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='watchers')
    added_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'user_watchlists'
        unique_together = [['user', 'stock']]
        ordering = ['-added_at']

    def __str__(self):
        return f"{self.user.username} → {self.stock.symbol}"


class AIScreeningJob(models.Model):
    """Track AI-powered stock screening jobs"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ai_screening_jobs')
    status = models.CharField(max_length=20, choices=[('pending', 'Pending'), ('running', 'Running'), ('completed', 'Completed'), ('failed', 'Failed')], default='pending')
    sector = models.CharField(max_length=100, null=True, blank=True)
    limit = models.IntegerField(default=10)
    current_stock = models.CharField(max_length=20, null=True, blank=True)
    stocks_screened = models.IntegerField(default=0)
    total_stocks = models.IntegerField(default=0)
    result = models.JSONField(null=True, blank=True)
    error = models.TextField(null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'ai_screening_jobs'
        ordering = ['-started_at']

    def __str__(self):
        return f"AI Screening Job {self.id} - {self.status}"


class Portfolio(models.Model):
    """User's stock portfolio with buy details"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='portfolio')
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='holders')
    quantity = models.IntegerField(default=0)
    buy_price = models.DecimalField(max_digits=10, decimal_places=2)
    buy_date = models.DateField()
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'portfolio'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} — {self.stock.symbol} x{self.quantity}"


class ScrapeJob(models.Model):
    """Track scraping jobs triggered by users"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='scrape_jobs')
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='scrape_jobs')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    records_saved = models.IntegerField(default=0)
    error = models.TextField(blank=True, default='')

    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'scrape_jobs'
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.stock.symbol} - {self.status}"


class BulkScrapeJob(models.Model):
    """Track bulk scraping jobs (scrape all stocks)"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bulk_scrape_jobs', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_stocks = models.IntegerField(default=0)
    scraped_stocks = models.IntegerField(default=0)
    failed_stocks = models.IntegerField(default=0)
    current_symbol = models.CharField(max_length=20, blank=True, default='')
    error = models.TextField(blank=True, default='')

    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'bulk_scrape_jobs'
        ordering = ['-started_at']

    def __str__(self):
        return f"BulkScrape - {self.status} ({self.scraped_stocks}/{self.total_stocks})"


class NEPSEIndex(models.Model):
    """NEPSE index data with minute-level and daily data"""
    timestamp = models.DateTimeField(unique=True)
    value = models.DecimalField(max_digits=10, decimal_places=2)
    open = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    high = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    low = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    volume = models.BigIntegerField(default=0)
    turnover = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    transactions = models.IntegerField(null=True, blank=True)
    shares = models.IntegerField(null=True, blank=True)
    is_minute_data = models.BooleanField(default=False)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['-timestamp']),
            models.Index(fields=['is_minute_data']),
        ]

    def __str__(self):
        return f"NEPSE Index: {self.value} at {self.timestamp}"


class NEPSEInsight(models.Model):
    """AI-generated insights for NEPSE index"""
    insight = models.TextField()
    time_range = models.CharField(max_length=20, help_text="e.g., '7d', '1d'")
    generated_at = models.DateTimeField(auto_now_add=True)
    is_market_closed = models.BooleanField(default=False)

    class Meta:
        db_table = 'nepse_insights'
        ordering = ['-generated_at']

    def __str__(self):
        return f"NEPSE Insight ({self.time_range}) - {self.generated_at}"


class NEPSEPrediction(models.Model):
    """AI-generated predictions for NEPSE index"""
    day = models.IntegerField(help_text="Day number (1-7)")
    predicted_value = models.DecimalField(max_digits=12, decimal_places=2)
    upper_bound = models.DecimalField(max_digits=12, decimal_places=2)
    lower_bound = models.DecimalField(max_digits=12, decimal_places=2)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'nepse_predictions'
        ordering = ['day']

    def __str__(self):
        return f"Day {self.day}: {self.predicted_value} ({self.lower_bound} - {self.upper_bound})"