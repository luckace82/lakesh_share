from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.cache import cache
import logging
from .vector_search import stock_search
from .scraper_tasks import ai_screener_task
import json

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chat_query(request):
    """Smart chat endpoint with vector search and on-demand data loading"""
    try:
        query = request.data.get('query', '').strip()
        if not query:
            return Response({'error': 'Query is required'}, status=400)
        
        # Step 1: Find relevant stocks using vector search
        relevant_stocks = stock_search.search_stocks(query, top_k=10)
        
        # Step 2: Load detailed data only for relevant stocks
        detailed_stocks = []
        for stock_info in relevant_stocks:
            symbol = stock_info['symbol']
            detailed_data = stock_search.get_stock_details(symbol, days=30)
            if detailed_data:
                detailed_stocks.append({
                    **detailed_data,
                    'similarity': stock_info['similarity']
                })
        
        # Step 3: Build context for AI
        context = build_ai_context(detailed_stocks, query)
        
        # Step 4: Get AI response
        ai_response = get_ai_response(query, context)
        
        return Response({
            'query': query,
            'relevant_stocks': detailed_stocks,
            'ai_response': ai_response,
            'context_used': context
        })
        
    except Exception as e:
        logger.error(f"Chat query error: {e}")
        return Response({'error': 'Failed to process query'}, status=500)

def build_ai_context(stocks, query):
    """Build rich context for AI from stock data"""
    context = {
        'query': query,
        'stocks_found': len(stocks),
        'stock_data': []
    }
    
    for stock in stocks:
        stock_context = {
            'symbol': stock['symbol'],
            'name': stock['name'],
            'sector': stock['sector'],
            'current_price': stock['live_price']['ltp'] if stock['live_price'] else None,
            'change_percent': stock['live_price']['change_percent'] if stock['live_price'] else None,
            'rsi': stock['indicators']['rsi_14'],
            'ma_20': stock['indicators']['ma_20'],
            'ma_50': stock['indicators']['ma_50'],
            'price_change_7d': stock['indicators']['price_change_pct_7d'],
            'recent_trend': 'up' if stock['indicators']['price_change_pct_7d'] and stock['indicators']['price_change_pct_7d'] > 0 else 'down',
            'similarity_score': stock['similarity']
        }
        context['stock_data'].append(stock_context)
    
    return context

def get_ai_response(query, context):
    """Get AI response using Ollama"""
    from django.conf import settings
    import requests
    
    # Build prompt
    stocks_info = "\n".join([
        f"- {stock['symbol']} ({stock['name']}): Current {stock['current_price']}, "
        f"Change {stock['change_percent']:+.2f}%, RSI {stock['rsi']}, "
        f"7-day change {stock['price_change_7d']:+.2f}%"
        for stock in context['stock_data']
    ])
    
    prompt = f"""You are a NEPSE stock market expert. Answer the user's question based on the provided stock data.

User Question: {query}

Available Stock Data:
{stocks_info}

Context: Found {context['stocks_found']} relevant stocks with similarity scores.

Provide a helpful, concise answer. If the user asks for specific stock analysis, focus on the most relevant stocks. 
If they ask for general market questions, provide an overview based on the available data.

Be conversational and informative. Include specific numbers and percentages when relevant."""

    try:
        ollama_url = getattr(settings, 'OLLAMA_BASE_URL', 'http://localhost:11434')
        response = requests.post(
            f"{ollama_url}/api/generate",
            json={
                'model': getattr(settings, 'OLLAMA_MODEL', 'llama3:8b'),
                'prompt': prompt,
                'stream': False
            },
            timeout=60
        )
        response.raise_for_status()
        return response.json().get('response', 'Sorry, I could not process your request.')
        
    except Exception as e:
        logger.error(f"AI response error: {e}")
        return "I'm having trouble connecting to my AI brain right now. Please try again."

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_search(request):
    """Simple stock search using vector similarity"""
    query = request.data.get('query', '').strip()
    if not query:
        return Response({'error': 'Query is required'}, status=400)
    
    results = stock_search.search_stocks(query, top_k=10)
    return Response({'results': results})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_details(request, symbol):
    """Get detailed stock data on-demand"""
    details = stock_search.get_stock_details(symbol, days=30)
    if not details:
        return Response({'error': 'Stock not found'}, status=404)
    
    return Response(details)
