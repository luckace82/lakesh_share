import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getWatchlist, removeFromWatchlist, getStockHistory, autoScrapeWatchlist } from '../api/client';
import WatchlistCard from '../components/WatchlistCard';
import { Star, RefreshCw, Loader2 } from 'lucide-react';

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

      // Fetch historical data for sparklines and indicators (skip symbols with slashes)
      const historyPromises = watchlistData.map(async (item) => {
        if (item.stock.symbol.includes('/')) {
          return { symbol: item.stock.symbol, history: [] };
        }
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
    <div>
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
              variant="full"
            />
          ))}
        </div>
      )}
    </div>
  );
}
