import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getStockDetail, getStockHistory } from '../api/client';
import { useAuth } from '../context/AuthContext';
import OverviewTab from '../components/OverviewTab';
import ChartsTab from '../components/ChartsTab';
import HistoryTab from '../components/HistoryTab';
import AITab from '../components/AITab';
import { BarChart3, LineChart, Table2, Bot } from 'lucide-react';

const TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'charts', label: 'Charts', icon: LineChart },
  { key: 'history', label: 'History', icon: Table2 },
  { key: 'ai', label: 'AI Analyzer', icon: Bot },
];

export default function StockDetail() {
  const { symbol } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stock, setStock] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const detailRes = await getStockDetail(symbol);
      setStock(detailRes.data);
    } catch {
      // Stock not in DB yet — that's OK
      setStock({ symbol: symbol.toUpperCase(), name: symbol.toUpperCase(), daily_count: 0 });
    }
    try {
      const histRes = await getStockHistory(symbol);
      setHistory(histRes.data);
    } catch {
      setHistory([]);
    }
    setLoading(false);
  };


  useEffect(() => {
    fetchData();
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="card mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-bold text-[var(--color-primary-text)]">{stock?.symbol}</h1>
            <p className="text-[var(--color-secondary-text)] mt-0.5">{stock?.name} {stock?.sector && <span className="badge badge-info ml-2">{stock.sector}</span>}</p>
          </div>
          <div className="flex items-center gap-4">
            {stock?.latest_price && (
              <div className="text-right">
                <p className="text-[36px] font-bold font-mono text-[var(--color-primary-text)]">NPR {parseFloat(stock.latest_price.ltp).toLocaleString()}</p>
                <div className={`badge ${parseFloat(stock.latest_price.change) >= 0 ? 'badge-gain' : 'badge-loss'} mt-2`}>
                  {parseFloat(stock.latest_price.change) >= 0 ? '+' : ''}{stock.latest_price.change} ({stock.latest_price.change_percent}%)
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-[var(--color-loss-tint)] border border-[var(--color-loss)]/30 text-[var(--color-loss)] rounded-lg p-3 text-sm mb-6">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--color-card-bg)] p-1 rounded-lg border border-[var(--color-border)] mb-6">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border-0 ${
                isActive
                  ? 'bg-[var(--color-brand-tint)] text-[var(--color-brand)] border-b-2 border-[var(--color-brand)]'
                  : 'text-[var(--color-secondary-text)] hover:text-[var(--color-primary-text)] hover:bg-[var(--color-border)] bg-transparent'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="card">
        {tab === 'overview' && <OverviewTab stock={stock} history={history} user={user} />}
        {tab === 'charts' && <ChartsTab stock={stock} history={history} />}
        {tab === 'history' && <HistoryTab history={history} />}
        {tab === 'ai' && <AITab symbol={symbol} user={user} />}
      </div>
    </div>
  );
}
