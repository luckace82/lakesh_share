import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, TrendingUp, AlertCircle } from 'lucide-react';
import { chatQuery, stockSearch } from '../api/client';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [relevantStocks, setRelevantStocks] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatQuery({ query: input });
      
      const aiMessage = {
        role: 'assistant',
        content: response.data.ai_response,
        timestamp: new Date(),
        relevantStocks: response.data.relevantStocks || []
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setRelevantStocks(response.data.relevantStocks || []);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const getStockIcon = (stock) => {
    const change = stock.change_percent || 0;
    return change >= 0 ? TrendingUp : AlertCircle;
  };

  const getStockColor = (stock) => {
    const change = stock.change_percent || 0;
    return change >= 0 ? 'text-[var(--color-gain)]' : 'text-[var(--color-loss)]';
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-page-bg)]">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] p-4">
        <div className="flex items-center gap-3">
          <div className="bg-[var(--color-brand)] p-2 rounded-lg">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-primary-text)]">AI Stock Assistant</h1>
            <p className="text-sm text-[var(--color-secondary-text)]">Ask me anything about NEPSE stocks</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="h-12 w-12 text-[var(--color-brand)] mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-[var(--color-primary-text)] mb-2">Welcome to AI Stock Chat</h3>
            <p className="text-[var(--color-secondary-text)] mb-4">
              Ask me about stock analysis, market trends, or specific companies
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['How are banking stocks performing?', 'What about NABIL?', 'Show me top gainers today'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-1.5 text-xs bg-[var(--color-border)] text-[var(--color-secondary-text)] rounded-full hover:bg-[var(--color-brand)] hover:text-white transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && (
                <div className="bg-[var(--color-brand)] p-2 rounded-lg h-8 w-8 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              
              <div className={`max-w-[70%] ${message.role === 'user' ? 'order-first' : ''}`}>
                <div className={`p-3 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-[var(--color-brand)] text-white' 
                    : message.isError
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : 'bg-[var(--color-card-bg)] border border-[var(--color-border)] text-[var(--color-primary-text)]'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                
                {/* Show relevant stocks if available */}
                {message.relevantStocks && message.relevantStocks.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {message.relevantStocks.map((stock) => {
                      const Icon = getStockIcon(stock);
                      return (
                        <div key={stock.symbol} className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${getStockColor(stock)}`} />
                              <div>
                                <span className="font-medium text-[var(--color-primary-text)]">{stock.symbol}</span>
                                <span className="text-[var(--color-secondary-text)] ml-2">{stock.name}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono text-sm text-[var(--color-primary-text)]">
                                {stock.live_price?.ltp ? `NPR ${stock.live_price.ltp.toLocaleString()}` : 'N/A'}
                              </div>
                              <div className={`text-xs ${getStockColor(stock)}`}>
                                {stock.live_price?.change_percent ? 
                                  `${stock.live_price.change_percent >= 0 ? '+' : ''}${stock.live_price.change_percent.toFixed(2)}%` : 
                                  'N/A'
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <p className="text-xs text-[var(--color-secondary-text)] mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
              
              {message.role === 'user' && (
                <div className="bg-[var(--color-brand)] p-2 rounded-lg h-8 w-8 flex items-center justify-center flex-shrink-0 order-first">
                  <User className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="bg-[var(--color-brand)] p-2 rounded-lg h-8 w-8 flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--color-brand)]" />
                <span className="text-sm text-[var(--color-secondary-text)]">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--color-border)] p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about stocks, market trends, or specific companies..."
            className="flex-1 px-4 py-2 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-primary-text)] placeholder-[var(--color-secondary-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
