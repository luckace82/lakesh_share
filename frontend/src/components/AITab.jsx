import { useState, useRef, useEffect } from 'react';
import { analyzeStock } from '../api/client';
import { Bot, Send, Loader2, TrendingUp, AlertTriangle, Zap, BarChart3 } from 'lucide-react';

const QUICK_PROMPTS = [
  { label: 'Full Analysis', prompt: '', icon: TrendingUp },
  { label: 'Is it a good buy?', prompt: 'Should I buy this stock right now? Give specific reasons.', icon: Zap },
  { label: 'Short-term prediction', prompt: 'Predict the price movement for the next 1-2 weeks with specific levels.', icon: TrendingUp },
  { label: 'Risk assessment', prompt: 'What are the major risks of holding this stock?', icon: AlertTriangle },
  { label: 'Support & Resistance', prompt: 'Identify key support and resistance levels for this stock.', icon: BarChart3 },
  { label: 'Compare with sector', prompt: 'How does this stock perform compared to its sector peers?', icon: BarChart3 },
];

export default function AITab({ symbol, user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const msgEndRef = useRef(null);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (messageText) => {
    if (!user) return alert('Please login to use AI analysis');
    const userMsg = (messageText || input || '').trim() || `Analyze ${symbol} stock and provide a prediction.`;

    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const res = await analyzeStock(symbol, userMsg);
      setMessages((prev) => [...prev, { role: 'ai', content: res.data.analysis, stats: res.data.stats }]);
    } catch (err) {
      const errMsg = err.response?.data?.error || 'AI analysis failed. Make sure Ollama is running.';
      setMessages((prev) => [...prev, { role: 'error', content: errMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() && messages.length === 0) sendMessage('');
    else if (input.trim()) sendMessage(input.trim());
  };

  if (!user) {
    return (
      <div className="card border-dashed flex flex-col items-center justify-center p-12">
        <Bot className="h-12 w-12 text-[var(--color-secondary-text)] mx-auto mb-3" />
        <p className="text-[var(--color-secondary-text)]">Login to use AI-powered stock analysis</p>
        <p className="text-[var(--color-secondary-text)] text-sm mt-1 opacity-60">Powered by Llama 3:8b via Ollama</p>
      </div>
    );
  }

  return (
    <div className="card flex flex-col !p-0" style={{ height: '70vh' }}>
      {/* Messages area - scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Quick Prompts - only show when no messages */}
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <Bot className="h-12 w-12 text-[var(--color-brand)] mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-[var(--color-primary-text)]">AI Stock Analyzer</h3>
              <p className="text-[var(--color-secondary-text)] text-sm mt-1">Powered by Llama 3:8b — Ask anything about {symbol}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {QUICK_PROMPTS.map((q) => {
                const Icon = q.icon;
                return (
                  <button key={q.label} onClick={() => sendMessage(q.prompt)}
                    className="flex items-center gap-2 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg p-3 text-left hover:border-[var(--color-brand)] text-sm transition-colors cursor-pointer">
                    <Icon className="h-4 w-4 text-[var(--color-brand)] shrink-0" />
                    <span className="text-[var(--color-primary-text)] text-xs">{q.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg, i) => (
          <div key={i} className={`${msg.role === 'user' ? 'flex justify-end' : ''}`}>
            {msg.role === 'user' ? (
              <div className="bg-[var(--color-brand-tint)] border border-[var(--color-brand)] rounded-xl px-4 py-3 max-w-[80%]">
                <p className="text-[var(--color-brand)] text-sm">{msg.content}</p>
              </div>
            ) : msg.role === 'error' ? (
              <div className="bg-[var(--color-loss-tint)] border border-[var(--color-loss)] rounded-xl px-4 py-3">
                <p className="text-[var(--color-loss)] text-sm">{msg.content}</p>
              </div>
            ) : (
              <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-4">
                {msg.stats && (
                  <div className="flex flex-wrap gap-3 mb-3 pb-3 border-b border-[var(--color-border)] text-xs">
                    <span className="badge badge-neutral">Price: <span className="font-mono font-medium text-[var(--color-primary-text)]">NPR {msg.stats.current_price}</span></span>
                    <span className="badge badge-neutral">RSI: <span className={`font-mono ${msg.stats.rsi > 70 ? 'text-loss' : msg.stats.rsi < 30 ? 'text-gain' : 'text-warning'}`}>{msg.stats.rsi}</span></span>
                    <span className="badge badge-neutral">MA20: <span className="font-mono text-[var(--color-warning)]">{msg.stats.ma20}</span></span>
                    <span className="badge badge-neutral">90d H/L: <span className="font-mono text-[var(--color-info)]">{msg.stats.high_90d}/{msg.stats.low_90d}</span></span>
                  </div>
                )}
                <div className="text-[var(--color-primary-text)] text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-[var(--color-secondary-text)] text-sm py-2">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--color-brand)]" />
            Analyzing {symbol}... (this may take a moment)
          </div>
        )}
        <div ref={msgEndRef} />
      </div>

      {/* Input - fixed at bottom */}
      <div className="border-t border-[var(--color-border)] p-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask about ${symbol}...`}
            disabled={loading}
            className="input flex-1 rounded-xl"
          />
          <button type="submit" disabled={loading}
            className="btn-primary px-5 py-3 rounded-xl disabled:opacity-50">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
