from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Stock, DailyPrice, LivePrice, UserWatchlist, Portfolio, ScrapeJob, NEPSEIndex, NEPSEInsight, NEPSEPrediction, BulkScrapeJob


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password2 = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2']

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']


class StockSerializer(serializers.ModelSerializer):
    daily_count = serializers.SerializerMethodField()

    class Meta:
        model = Stock
        fields = ['id', 'symbol', 'name', 'sector', 'is_active', 'last_scraped', 'rsi_14', 'ma_20', 'ma_50', 'price_change_pct_7d', 'price_change_pct_30d', 'volume_avg_30d', 'indicators_updated', 'daily_count']

    def get_daily_count(self, obj):
        return obj.daily_prices.count()


class DailyPriceSerializer(serializers.ModelSerializer):
    symbol = serializers.CharField(source='stock.symbol', read_only=True)

    class Meta:
        model = DailyPrice
        fields = ['id', 'symbol', 'date', 'open', 'high', 'low', 'close', 'volume']


class LivePriceSerializer(serializers.ModelSerializer):
    symbol = serializers.CharField(source='stock.symbol', read_only=True)

    class Meta:
        model = LivePrice
        fields = ['id', 'symbol', 'ltp', 'change', 'change_percent', 'volume', 'high', 'low', 'timestamp']


class WatchlistSerializer(serializers.ModelSerializer):
    stock = StockSerializer(read_only=True)
    stock_symbol = serializers.CharField(write_only=True)
    latest_price = serializers.SerializerMethodField()

    class Meta:
        model = UserWatchlist
        fields = ['id', 'stock', 'stock_symbol', 'latest_price', 'added_at']

    def get_latest_price(self, obj):
        from django.utils import timezone
        from datetime import timedelta
        
        live = obj.stock.live_prices.first()
        if live:
            # If live price is very old, fallback to daily price
            if live.timestamp < timezone.now() - timedelta(days=7):
                latest_daily = obj.stock.daily_prices.order_by('-date').first()
                if latest_daily:
                    return {
                        'ltp': str(latest_daily.close),
                        'change': '0.00',
                        'change_percent': '0.00',
                        'timestamp': latest_daily.date.isoformat(),
                    }
            return {
                'ltp': str(live.ltp),
                'change': str(live.change),
                'change_percent': str(live.change_percent),
                'timestamp': live.timestamp,
            }
        
        # Fallback to latest daily price
        latest_daily = obj.stock.daily_prices.order_by('-date').first()
        if latest_daily:
            return {
                'ltp': str(latest_daily.close),
                'change': '0.00',
                'change_percent': '0.00',
                'timestamp': latest_daily.date.isoformat(),
            }
        return None

    def create(self, validated_data):
        symbol = validated_data.pop('stock_symbol').upper()
        stock, _ = Stock.objects.get_or_create(
            symbol=symbol,
            defaults={'name': symbol}
        )
        obj, created = UserWatchlist.objects.get_or_create(
            user=self.context['request'].user,
            stock=stock,
        )
        return obj


class PortfolioSerializer(serializers.ModelSerializer):
    stock = StockSerializer(read_only=True)
    stock_symbol = serializers.CharField(write_only=True)
    current_price = serializers.SerializerMethodField()
    profit_loss = serializers.SerializerMethodField()
    profit_loss_pct = serializers.SerializerMethodField()

    class Meta:
        model = Portfolio
        fields = ['id', 'stock', 'stock_symbol', 'quantity', 'buy_price', 'buy_date',
                  'notes', 'current_price', 'profit_loss', 'profit_loss_pct', 'created_at']

    def get_current_price(self, obj):
        from django.utils import timezone
        from datetime import timedelta
        
        live = obj.stock.live_prices.first()
        if live:
            # If live price is very old, fallback to daily price
            if live.timestamp < timezone.now() - timedelta(days=7):
                latest_daily = obj.stock.daily_prices.order_by('-date').first()
                if latest_daily:
                    return float(latest_daily.close)
            return float(live.ltp)
        
        # Fallback to latest daily price
        latest_daily = obj.stock.daily_prices.order_by('-date').first()
        return float(latest_daily.close) if latest_daily else None

    def get_profit_loss(self, obj):
        from decimal import Decimal
        current_price = self.get_current_price(obj)
        if current_price:
            current_decimal = Decimal(str(current_price))
            return round(float(current_decimal - obj.buy_price) * obj.quantity, 2)
        return None

    def get_profit_loss_pct(self, obj):
        from decimal import Decimal
        current_price = self.get_current_price(obj)
        if current_price and obj.buy_price:
            current_decimal = Decimal(str(current_price))
            return round(float((current_decimal - obj.buy_price) / obj.buy_price) * 100, 2)
        return None

    def create(self, validated_data):
        symbol = validated_data.pop('stock_symbol').upper()
        stock, _ = Stock.objects.get_or_create(symbol=symbol, defaults={'name': symbol})
        return Portfolio.objects.create(
            user=self.context['request'].user,
            stock=stock,
            **validated_data
        )


class ScrapeJobSerializer(serializers.ModelSerializer):
    symbol = serializers.CharField(source='stock.symbol', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = ScrapeJob
        fields = ['id', 'symbol', 'username', 'status', 'records_saved', 'error', 'started_at', 'completed_at']


class BulkScrapeJobSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True, allow_null=True)

    class Meta:
        model = BulkScrapeJob
        fields = ['id', 'username', 'status', 'total_stocks', 'scraped_stocks', 'failed_stocks', 'current_symbol', 'error', 'started_at', 'completed_at']


class StockDetailSerializer(serializers.ModelSerializer):
    daily_count = serializers.SerializerMethodField()
    latest_price = serializers.SerializerMethodField()

    class Meta:
        model = Stock
        fields = ['id', 'symbol', 'name', 'sector', 'is_active', 'last_scraped', 'daily_count', 'latest_price']

    def get_daily_count(self, obj):
        return obj.daily_prices.count()

    def get_latest_price(self, obj):
        from django.utils import timezone
        from datetime import timedelta

        live = obj.live_prices.first()  # This gets the newest because LivePrice orders by -timestamp
        if live:
            # If live price is very old (more than 7 days), fallback to daily price
            if live.timestamp < timezone.now() - timedelta(days=7):
                latest_daily = obj.daily_prices.order_by('-date').first()
                if latest_daily:
                    return {
                        'ltp': str(latest_daily.close),
                        'change': '0.00',
                        'change_percent': '0.00',
                        'volume': latest_daily.volume,
                        'high': str(latest_daily.high),
                        'low': str(latest_daily.low),
                        'timestamp': latest_daily.date.isoformat(),
                    }
            return LivePriceSerializer(live).data

        # Fallback to latest daily price if no live price exists
        latest_daily = obj.daily_prices.order_by('-date').first()
        if latest_daily:
            return {
                'ltp': str(latest_daily.close),
                'change': '0.00',
                'change_percent': '0.00',
                'volume': latest_daily.volume,
                'high': str(latest_daily.high),
                'low': str(latest_daily.low),
                'timestamp': latest_daily.date.isoformat(),
            }
        return None


class NEPSEIndexSerializer(serializers.ModelSerializer):
    class Meta:
        model = NEPSEIndex
        fields = ['id', 'timestamp', 'value', 'open', 'high', 'low', 'volume', 'turnover', 'transactions', 'shares', 'is_minute_data']


class NEPSEInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = NEPSEInsight
        fields = ['id', 'insight', 'time_range', 'generated_at', 'is_market_closed']


class NEPSEPredictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = NEPSEPrediction
        fields = ['id', 'day', 'predicted_value', 'upper_bound', 'lower_bound', 'generated_at']
