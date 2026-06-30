import numpy as np
from sentence_transformers import SentenceTransformer
from market.models import Stock, DailyPrice
from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)

class StockVectorSearch:
    def __init__(self):
        # Load a lightweight sentence transformer model
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.stock_vectors = None
        self.stock_data = None
        
    def build_stock_vectors(self):
        """Build vectors for all stocks with rich metadata"""
        stocks = Stock.objects.filter(is_active=True)
        
        # Create rich text descriptions for each stock
        stock_texts = []
        stock_data = []
        
        for stock in stocks:
            # Combine multiple data points for better semantic matching
            text = f"{stock.symbol} {stock.name} {stock.sector}"
            if stock.sector:
                text += f" banking finance insurance hydro development commercial"
            
            stock_texts.append(text)
            stock_data.append({
                'symbol': stock.symbol,
                'name': stock.name,
                'sector': stock.sector,
                'latest_price': float(stock.live_prices.first().ltp) if stock.live_prices.exists() else None,
                'rsi_14': stock.rsi_14,
                'ma_20': stock.ma_20,
                'price_change_pct_7d': stock.price_change_pct_7d
            })
        
        # Generate embeddings
        embeddings = self.model.encode(stock_texts)
        
        # Store for fast searching
        self.stock_vectors = embeddings
        self.stock_data = stock_data
        
        # Cache for 1 hour
        cache.set('stock_vectors', embeddings, 3600)
        cache.set('stock_data', stock_data, 3600)
        
        logger.info(f"Built vectors for {len(stocks)} stocks")
        return len(stocks)
    
    def search_stocks(self, query, top_k=5):
        """Search for stocks using semantic similarity"""
        # Load from cache if available
        if self.stock_vectors is None:
            cached_vectors = cache.get('stock_vectors')
            cached_data = cache.get('stock_data')
            if cached_vectors is not None and cached_data is not None:
                self.stock_vectors = cached_vectors
                self.stock_data = cached_data
            else:
                self.build_stock_vectors()
        
        # Encode the query
        query_vector = self.model.encode([query])
        
        # Calculate cosine similarity
        from sklearn.metrics.pairwise import cosine_similarity
        similarities = cosine_similarity(query_vector, self.stock_vectors)[0]
        
        # Get top-k results
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            if similarities[idx] > 0.3:  # Threshold for relevance
                stock_info = self.stock_data[idx].copy()
                stock_info['similarity'] = float(similarities[idx])
                results.append(stock_info)
        
        return results
    
    def get_stock_details(self, symbol, days=30):
        """Get detailed stock data on-demand"""
        try:
            stock = Stock.objects.get(symbol=symbol.upper())
            
            # Get recent prices
            from django.utils import timezone
            from datetime import timedelta
            
            cutoff = timezone.now().date() - timedelta(days=days)
            daily_prices = stock.daily_prices.filter(
                date__gte=cutoff
            ).order_by('date').values('date', 'open', 'high', 'low', 'close', 'volume')
            
            # Get live price
            live_price = stock.live_prices.first()
            
            return {
                'symbol': stock.symbol,
                'name': stock.name,
                'sector': stock.sector,
                'live_price': {
                    'ltp': float(live_price.ltp),
                    'change': float(live_price.change),
                    'change_percent': float(live_price.change_percent),
                    'volume': int(live_price.volume),
                    'high': float(live_price.high),
                    'low': float(live_price.low),
                    'timestamp': live_price.timestamp.isoformat()
                } if live_price else None,
                'indicators': {
                    'rsi_14': stock.rsi_14,
                    'ma_20': stock.ma_20,
                    'ma_50': stock.ma_50,
                    'price_change_pct_7d': stock.price_change_pct_7d,
                    'price_change_pct_30d': stock.price_change_pct_30d
                },
                'daily_prices': list(daily_prices)
            }
            
        except Stock.DoesNotExist:
            return None

# Global instance
stock_search = StockVectorSearch()
