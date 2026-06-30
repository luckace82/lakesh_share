import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getKnownStocks, getWatchlist, addToWatchlist, removeFromWatchlist, getStocks, autoScrapeWatchlist, getStockHistory, triggerScrape, getMarketStats, getBulkScrapeProgress, getScrapedStocksList } from '../api/client';
import WatchlistCard from '../components/WatchlistCard';
import StockCard from '../components/StockCard';
import { Search, Plus, X, Star, TrendingUp, TrendingDown, Database, RefreshCw, Activity, Loader2, Sun, Moon } from 'lucide-react';
import NEPSEIndexChart from '../components/NEPSEIndexChart';

export default function Dashboard() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [watchlistHistory, setWatchlistHistory] = useState({});
  const [dbStocks, setDbStocks] = useState([]);
  const [dbStockHistories, setDbStockHistories] = useState({});
  const [marketStats, setMarketStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [stockFilter, setStockFilter] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('nepse-dark-mode');
    return saved !== null ? saved === 'true' : true;
  });
  const [bulkScrapeProgress, setBulkScrapeProgress] = useState(null);
  const bulkScrapePollRef = useRef(null);
  const [showScrapedStocksModal, setShowScrapedStocksModal] = useState(false);
  const [scrapedStocksList, setScrapedStocksList] = useState([]);

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await getWatchlist();
      const data = res.data;
      const watchlistData = Array.isArray(data) ? data : [];
      setWatchlist(watchlistData);

      // Fetch historical data for sparklines and indicators (skip symbols with slashes)
      const historyPromises = watchlistData.map(async (item) => {
        if (item.stock.symbol.includes('/')) {
          return { [item.stock.symbol]: [] };
        }
        try {
          const history = await getStockHistory(item.stock.symbol, 90);
          return { [item.stock.symbol]: history };
        } catch {
          return { [item.stock.symbol]: [] };
        }
      });

      const historyResults = await Promise.all(historyPromises);
      const historyMap = historyResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      setWatchlistHistory(historyMap);
    } catch (error) {
      console.error('Error fetching watchlist:', error);
    }
  }, []);

  const fetchDbStocks = useCallback(async () => {
    try {
      const res = await getStocks();
      setDbStocks(res.data);

      // Fetch history for sparklines (skip symbols with slashes — backend route conflict)
      const historyPromises = res.data.map(async (stock) => {
        if (stock.symbol.includes('/')) {
          return { symbol: stock.symbol, history: [] };
        }
        try {
          const histRes = await getStockHistory(stock.symbol, 30);
          return { symbol: stock.symbol, history: histRes.data };
        } catch {
          return { symbol: stock.symbol, history: [] };
        }
      });

      const historyResults = await Promise.all(historyPromises);
      const historyMap = {};
      historyResults.forEach(({ symbol, history }) => {
        historyMap[symbol] = history;
      });
      setDbStockHistories(historyMap);
    } catch (error) {
      console.error('Error fetching stocks:', error);
    }
  }, []);

  const fetchMarketStats = useCallback(async () => {
    try {
      const res = await getMarketStats();
      setMarketStats(res.data);
    } catch (error) {
      console.error('Error fetching market stats:', error);
    }
  }, []);

  const fetchScrapedStocksList = useCallback(async () => {
    try {
      const res = await getScrapedStocksList();
      setScrapedStocksList(res.data);
    } catch (error) {
      console.error('Error fetching scraped stocks list:', error);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchWatchlist(), fetchDbStocks(), fetchMarketStats()]).finally(() => setLoading(false));
  }, [fetchWatchlist, fetchDbStocks, fetchMarketStats]);

  useEffect(() => {
    if (search.length < 1) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await getKnownStocks(search);
        setSuggestions(res.data.slice(0, 15));
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('nepse-dark-mode', darkMode);
  }, [darkMode]);

  const handleAdd = async (symbol) => {
    try {
      await addToWatchlist(symbol);
      setSearch('');
      setSuggestions([]);
      fetchWatchlist();
    } catch {}
  };

  const handleRemove = async (symbol) => {
    try { await removeFromWatchlist(symbol); fetchWatchlist(); } catch {}
  };

  const handleAutoScrape = async () => {
    setScraping(true);
    try {
      const res = await autoScrapeWatchlist();
      alert(`Scraping started for ${res.data.count} stock(s): ${res.data.triggered.join(', ') || 'All up to date'}`);
    } catch {}
    setScraping(false);
  };

  const handleScrapeAll = async () => {
    setScraping(true);
    try {
      // Get all stocks
      const stocksRes = await getStocks();
      const stocks = stocksRes.data;
      const total = stocks.length;
      let scraped = 0;
      let failed = 0;

      setBulkScrapeProgress({
        status: 'running',
        total_stocks: total,
        scraped_stocks: 0,
        failed_stocks: 0,
        current_symbol: ''
      });

      // Scrape each stock individually
      for (const stock of stocks) {
        try {
          setBulkScrapeProgress(prev => ({
            ...prev,
            current_symbol: stock.symbol
          }));
          await triggerScrape(stock.symbol);
          scraped += 1;
          setBulkScrapeProgress(prev => ({
            ...prev,
            scraped_stocks: scraped
          }));
          // Small delay between scrapes to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch {
          failed += 1;
          setBulkScrapeProgress(prev => ({
            ...prev,
            failed_stocks: failed
          }));
        }
      }

      setBulkScrapeProgress({
        status: 'completed',
        total_stocks: total,
        scraped_stocks: scraped,
        failed_stocks: failed,
        current_symbol: ''
      });

      fetchMarketStats();
      fetchDbStocks();
      alert(`Scraping completed: ${scraped}/${total} stocks scraped, ${failed} failed`);
    } catch (error) {
      console.error('Error scraping all stocks:', error);
      alert('Failed to scrape all stocks');
    }
    setScraping(false);
  };

  const startBulkScrapePolling = () => {
    if (bulkScrapePollRef.current) clearInterval(bulkScrapePollRef.current);
    bulkScrapePollRef.current = setInterval(async () => {
      try {
        const res = await getBulkScrapeProgress();
        setBulkScrapeProgress(res.data);
        if (res.data.status === 'completed' || res.data.status === 'failed') {
          clearInterval(bulkScrapePollRef.current);
          setScraping(false);
          if (res.data.status === 'completed') {
            fetchMarketStats();
            fetchDbStocks();
          }
        }
        // Continue polling if status is 'not_started' or 'running'
      } catch {
        clearInterval(bulkScrapePollRef.current);
        setScraping(false);
      }
    }, 3000);
  };

  const handleShowScrapedStocks = async () => {
    await fetchScrapedStocksList();
    setShowScrapedStocksModal(true);
  };

  const filteredStocks = stockFilter
    ? dbStocks.filter(s => s.symbol.includes(stockFilter.toUpperCase()) || s.name?.toLowerCase().includes(stockFilter.toLowerCase()))
    : dbStocks;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner h-8 w-8" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-[var(--color-primary-text)]">
            Dashboard
          </h1>
          <p className="text-[var(--color-secondary-text)] mt-1">
            Welcome back, {user?.username}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleScrapeAll}
            disabled={scraping}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {scraping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {bulkScrapeProgress && bulkScrapeProgress.status === 'running'
              ? `${bulkScrapeProgress.scraped_stocks}/${bulkScrapeProgress.total_stocks} Scraped${bulkScrapeProgress.current_symbol ? ` (${bulkScrapeProgress.current_symbol})` : ''}`
              : (scraping ? 'Scraping...' : 'Scrape All Stocks')}
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="btn-ghost"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* NEPSE Index Chart */}
      <NEPSEIndexChart />

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-secondary-text)]">Watchlist</p>
          <p className="text-[36px] font-bold font-mono text-[var(--color-primary-text)] mt-2">{watchlist.length}</p>
        </div>
        <div className="card">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-secondary-text)]">Stocks</p>
          <p className="text-[36px] font-bold font-mono text-[var(--color-primary-text)] mt-2">{dbStocks.length}</p>
        </div>
        <div className="card cursor-pointer" onClick={handleShowScrapedStocks}>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-secondary-text)]">Scraped</p>
          <p className="text-[36px] font-bold font-mono text-[var(--color-primary-text)] mt-2">{marketStats?.scraped_stocks || 0}</p>
        </div>
        <div className="card">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-secondary-text)]">Market Status</p>
          <p className={`text-[18px] font-bold mt-2 ${marketStats?.is_market_open ? 'text-[var(--color-gain)]' : 'text-[var(--color-loss)]'}`}>
            {marketStats?.is_market_open ? 'Open' : 'Closed'}
          </p>
          <p className="text-[12px] font-mono text-[var(--color-secondary-text)] mt-1">{marketStats?.nepal_time || '--:--'} NST</p>
        </div>
      </div>

      {/* Search */}
      <div className="card mb-8">
        <div className="relative">
          <div className="flex items-center input">
            <Search className="h-5 w-5 text-[var(--color-secondary-text)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search NEPSE stocks (e.g. NABIL, NICA, SBI, HIDCL)..."
              className="w-full bg-transparent border-0 px-3 py-3.5 text-[var(--color-primary-text)] focus:outline-none placeholder-[var(--color-secondary-text)] text-base"
            />
          </div>

          {suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg shadow-lg max-h-80 overflow-y-auto">
              {suggestions.map((s) => (
                <div key={s.symbol} className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] last:border-0">
                  <Link to={`/stocks/${s.symbol}`} className="flex-1 no-underline hover:bg-[var(--color-border)] -mx-4 px-4 py-3 transition-colors" onClick={() => { setSearch(''); setSuggestions([]); }}>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-[var(--color-primary-text)]">{s.symbol}</span>
                      <span className="text-[var(--color-secondary-text)] text-sm">{s.name}</span>
                      {s.sector && <span className="badge badge-info">{s.sector}</span>}
                    </div>
                  </Link>
                  <button
                    onClick={(e) => { e.preventDefault(); handleAdd(s.symbol); }}
                    className="ml-2 p-2 rounded-lg bg-[var(--color-brand-tint)] text-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white border-0 cursor-pointer transition-colors"
                    title="Add to watchlist"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Watchlist */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-[var(--color-warning)]" />
            <h2 className="text-[22px] font-bold text-[var(--color-primary-text)]">Your Watchlist</h2>
            <span className="badge badge-warning">{watchlist.length}</span>
          </div>
        </div>

        {watchlist.length === 0 ? (
          <div className="card border-dashed flex flex-col items-center justify-center p-12">
            <Star className="h-12 w-12 text-[var(--color-secondary-text)] mb-4" />
            <p className="text-[var(--color-secondary-text)] text-lg font-medium">Your watchlist is empty</p>
            <p className="text-[var(--color-secondary-text)] text-sm mt-2">Search and add stocks above to start tracking</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchlist.map((item) => (
              <WatchlistCard key={item.id} item={item} onRemove={handleRemove} history={watchlistHistory[item.stock.symbol] || []} variant="compact" />
            ))}
          </div>
        )}
      </div>

      {/* Stocks Database - moved to bottom */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-[var(--color-info)]" />
            <h2 className="text-[22px] font-bold text-[var(--color-primary-text)]">Stocks Database</h2>
            <span className="badge badge-info">{dbStocks.length}</span>
          </div>
          {dbStocks.length > 10 && (
            <div className="flex items-center input">
              <Search className="h-3.5 w-3.5 text-[var(--color-secondary-text)]" />
              <input 
                type="text" 
                value={stockFilter} 
                onChange={e => setStockFilter(e.target.value)} 
                placeholder="Filter..."
                className="bg-transparent border-0 px-2 py-1.5 text-sm text-[var(--color-primary-text)] focus:outline-none w-32"
              />
            </div>
          )}
        </div>

        {filteredStocks.length === 0 ? (
          <div className="card border-dashed flex flex-col items-center justify-center p-12">
            <Database className="h-12 w-12 text-[var(--color-secondary-text)] mb-4" />
            <p className="text-[var(--color-secondary-text)] text-lg font-medium">{stockFilter ? 'No matching stocks' : 'No stocks scraped yet'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredStocks.slice(0, 40).map((stock) => (
              <StockCard
                key={stock.id}
                stock={stock}
                history={dbStockHistories[stock.symbol] || []}
                variant="simple"
              />
            ))}
          </div>
        )}
        {filteredStocks.length > 40 && (
          <p className="text-[var(--color-secondary-text)] text-sm text-center mt-4">Showing 40 of {filteredStocks.length} stocks. Use filter to narrow down.</p>
        )}
      </div>

      {showScrapedStocksModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[var(--color-primary-text)]">Scraped Stocks ({scrapedStocksList.length})</h2>
              <button
                onClick={() => setShowScrapedStocksModal(false)}
                className="text-[var(--color-secondary-text)] hover:text-[var(--color-primary-text)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <div className="grid grid-cols-4 gap-2">
                {scrapedStocksList.map(stock => (
                  <Link
                    key={stock.id}
                    to={`/stocks/${stock.symbol}`}
                    onClick={() => setShowScrapedStocksModal(false)}
                    className="p-2 rounded bg-[var(--color-sidebar-bg)] hover:bg-[var(--color-border)] transition-colors text-center"
                  >
                    <p className="text-sm font-medium text-[var(--color-primary-text)]">{stock.symbol}</p>
                    <p className="text-xs text-[var(--color-secondary-text)] truncate">{stock.name}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

