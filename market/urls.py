from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views
from . import chat_views

urlpatterns = [
    # Auth
    path('auth/register/', views.RegisterView.as_view(), name='register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', views.MeView.as_view(), name='me'),

    # Stocks
    path('stocks/', views.StockListView.as_view(), name='stock-list'),
    path('stocks/known/', views.known_stocks_view, name='known-stocks'),
    path('stocks/<str:symbol>/', views.StockDetailView.as_view(), name='stock-detail'),
    path('stocks/<str:symbol>/history/', views.stock_history_view, name='stock-history'),
    path('stocks/<str:symbol>/live/', views.stock_live_view, name='stock-live'),

    # Scraping
    path('stocks/<str:symbol>/scrape/', views.TriggerScrapeView.as_view(), name='trigger-scrape'),
    path('scrape-jobs/<str:symbol>/status/', views.scrape_job_status_view, name='scrape-status'),

    # Watchlist
    path('watchlist/', views.WatchlistListView.as_view(), name='watchlist'),
    path('watchlist/auto-scrape/', views.auto_scrape_watchlist, name='auto-scrape'),
    path('watchlist/<str:symbol>/', views.WatchlistDeleteView.as_view(), name='watchlist-delete'),

    # Bulk scraping
    path('scrape-all/', views.scrape_all_stocks, name='scrape-all'),
    path('scrape-all/progress/', views.bulk_scrape_progress, name='bulk-scrape-progress'),
    path('scraped-stocks/', views.scraped_stocks_list, name='scraped-stocks-list'),
    path('stocks/all/', views.all_stocks_with_prices, name='all-stocks-with-prices'),

    # Screener
    path('screener/', views.screener_view, name='screener'),
    path('screener/auto/', views.auto_screener, name='auto-screener'),
    path('screener/auto/progress/', views.ai_screening_progress, name='ai-screening-progress'),

    # Portfolio Report
    path('portfolio/download-report/', views.download_portfolio_report, name='download-report'),

    # Portfolio
    path('portfolio/', views.PortfolioListView.as_view(), name='portfolio'),
    path('portfolio/<int:pk>/', views.PortfolioDeleteView.as_view(), name='portfolio-delete'),
    path('portfolio/<str:symbol>/transactions/', views.PortfolioTransactionsView, name='portfolio-transactions'),

    # AI
    path('ai/analyze/', views.AIAnalyzeView.as_view(), name='ai-analyze'),

    # NEPSE Index
    path('nepse-index/', views.nepse_index_data, name='nepse-index-data'),
    path('nepse-index/scrape/', views.scrape_nepse_index, name='scrape-nepse-index'),
    path('nepse-index/insights/', views.nepse_insights, name='nepse_insights'),
    path('nepse-index/insights/generate/', views.generate_nepse_insights, name='generate_nepse_insights'),
    path('nepse-index/predictions/', views.nepse_predictions, name='nepse_predictions'),
    path('nepse-index/predict/', views.generate_nepse_prediction, name='generate_nepse_prediction'),
    path('nepse-index/stats/', views.nepse_index_stats, name='nepse_index_stats'),
    path('market-stats/', views.market_stats, name='market_stats'),
    
    # Chat
    path('chat/query/', chat_views.chat_query, name='chat-query'),
    path('chat/search/', chat_views.stock_search, name='stock-search'),
    path('chat/stock/<str:symbol>/', chat_views.stock_details, name='chat-stock-details'),
]
