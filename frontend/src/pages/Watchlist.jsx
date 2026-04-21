import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getWatchlist, removeFromWatchlist, getStockHistory, autoScrapeWatchlist } from '../api/client';
import { Sparklines, SparklinesLine, SparklinesBars } from 'react-sparklines';
import { X, Star, TrendingUp, TrendingDown, Activity as VolumeIcon, RefreshCw, Loader2 } from 'lucide-react';

function WatchlistCard({ item, onRemove, history }) {
  const stock = item.stock;
  const price = item.latest_price;
  const isUp = price && price.change && parseFloat(price.change) >= 0;

  // Calculate RSI from history
  const calculateRSI = (prices, period = 14) => {
    if (!prices || prices.length < period + 1) return 50;
    const recent = prices.slice(-period - 1);
    let gains = 0, losses = 0;
    for (let i = 1; i < recent.length; i++) {
      const diff = recent[i] - recent[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  // Check for volume spike (volume > 2x average of last 10 days)
  const checkVolumeSpike = (history) => {
    if (!history || !Array.isArray(history) || history.length < 11) return false;
    const volumes = history.slice(-11, -1).map(h => parseFloat(h.volume));
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const latestVolume = parseFloat(history[history.length - 1].volume);
    return latestVolume > avgVolume * 2;
  };

  const rsi = history && Array.isArray(history) && history.length > 14 ? calculateRSI(history.map(h => parseFloat(h.close))) : 50;
  const hasVolumeSpike = checkVolumeSpike(history);
  const sparklineData = history && Array.isArray(history) ? history.slice(-20).map(h => parseFloat(h.close)) : [];

  return (
    <div className="card group p-6 hover:border-[var(--color-brand)] transition-colors">
      <div className="flex items-start justify-between mb-4">
        <Link to={`/stock/${stock.symbol}`} className="no-underline flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[22px] font-bold font-mono text-[var(--color-primary-text)] group-hover:text-[var(--color-brand)] transition-colors">{stock.symbol}</span>
            {hasVolumeSpike && <VolumeIcon className="h-4 w-4 text-[var(--color-warning)]" />}
          </div>
          <p className="text-[var(--color-secondary-text)] text-sm mt-1 truncate">{stock.name}</p>
        </Link>
        <button
          onClick={() => onRemove(stock.symbol)}
          className="p-2 rounded-lg hover:bg-[var(--color-loss-tint)] text-[var(--color-secondary-text)] hover:text-[var(--color-loss)] border-0 bg-transparent opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          title="Remove from watchlist"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {price && price.close ? (
        <>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-[38px] font-bold font-mono text-[var(--color-primary-text)]">
              {parseFloat(price.close).toFixed(2)}
            </span>
            <div className={`flex items-center gap-1 text-sm font-medium ${isUp ? 'text-[var(--color-gain)]' : 'text-[var(--color-loss)]'}`}>
              {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>{price.change ? parseFloat(price.change).toFixed(2) : '--'}</span>
              {price.change_pct && !isNaN(parseFloat(price.change_pct)) && <span>({parseFloat(price.change_pct).toFixed(2)}%)</span>}
            </div>
          </div>

          {sparklineData && sparklineData.length > 0 && (
            <div className="h-16 mb-4 flex items-center justify-center">
              <Sparklines data={sparklineData} width={200} height={64}>
                <SparklinesLine color={isUp ? '#4ade80' : '#f87171'} />
                <SparklinesBars color={isUp ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)'} />
              </Sparklines>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-[var(--color-secondary-text)]">RSI</span>
              <div
                className="w-20 h-2 rounded-full"
                style={{
                  backgroundColor: 'var(--color-border)'
                }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${rsi}%`,
                    backgroundColor: rsi > 70 ? 'var(--color-loss)' : rsi < 30 ? 'var(--color-gain)' : 'var(--color-brand)'
                  }}
                />
              </div>
              <span className="text-[12px] font-mono text-[var(--color-secondary-text)]">{rsi.toFixed(0)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={`text-[12px] font-medium ${rsi > 70 ? 'text-[var(--color-loss)]' : rsi < 30 ? 'text-[var(--color-gain)]' : 'text-[var(--color-secondary-text)]'}`}>
                {rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral'}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-8">
          <RefreshCw className="h-8 w-8 text-[var(--color-secondary-text)] mb-2" />
          <p className="text-[var(--color-secondary-text)] text-sm">No price data available</p>
        </div>
      )}
    </div>
  );
}

export default function Watchlist() {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState([]);
  const [watchlistHistory, setWatchlistHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await getWatchlist();
      const data = res.data;
      const watchlistData = Array.isArray(data) ? data : [];
      setWatchlist(watchlistData);

      // Fetch historical data for sparklines and indicators
      const historyPromises = watchlistData.map(async (item) => {
        try {
          const historyRes = await getStockHistory(item.stock.symbol, 90);
          return { symbol: item.stock.symbol, history: historyRes.data };
        } catch {
          return { symbol: item.stock.symbol, history: [] };
        }
      });

      const historyResults = await Promise.all(historyPromises);
      const historyMap = {};
      historyResults.forEach(({ symbol, history }) => {
        historyMap[symbol] = history;
      });
      setWatchlistHistory(historyMap);
    } catch (error) {
      console.error('Error fetching watchlist:', error);
    }
  }, []);

  const handleRemove = async (symbol) => {
    try {
      await removeFromWatchlist(symbol);
      await fetchWatchlist();
    } catch (error) {
      console.error('Error removing from watchlist:', error);
    }
  };

  const handleAutoScrape = async () => {
    setScraping(true);
    try {
      const res = await autoScrapeWatchlist();
      alert(`Scraping started for ${res.data.count} stock(s): ${res.data.triggered.join(', ') || 'All up to date'}`);
    } catch {}
    setScraping(false);
  };

  useEffect(() => {
    fetchWatchlist().finally(() => setLoading(false));
  }, [fetchWatchlist]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-bold text-[var(--color-primary-text)]">
            Watchlist
          </h1>
          <p className="text-[var(--color-secondary-text)] mt-1">
            {watchlist.length} stock{watchlist.length !== 1 ? 's' : ''} in your watchlist
          </p>
        </div>
        <button
          onClick={handleAutoScrape}
          disabled={scraping}
          className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
        >
          {scraping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {scraping ? 'Scraping...' : 'Auto Scrape'}
        </button>
      </div>

      {watchlist.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-12">
          <Star className="h-12 w-12 text-[var(--color-secondary-text)] mb-4" />
          <p className="text-[var(--color-secondary-text)] mb-2">Your watchlist is empty</p>
          <p className="text-[var(--color-secondary-text)] text-sm">Add stocks from the Dashboard to track them here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {watchlist.map((item) => (
            <WatchlistCard
              key={item.id}
              item={item}
              onRemove={handleRemove}
              history={watchlistHistory[item.stock.symbol] || []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
