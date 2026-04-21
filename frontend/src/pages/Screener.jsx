import { useState, useEffect } from 'react';
import { getStocks, autoScreener, getAIScreeningProgress, addToWatchlist } from '../api/client';
import { Search, Filter, TrendingUp, TrendingDown, Brain, Sparkles, X, Plus } from 'lucide-react';

export default function Screener() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const [aiScreeningProgress, setAiScreeningProgress] = useState(null);
  const [aiResults, setAiResults] = useState([]);
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [showStockSelector, setShowStockSelector] = useState(false);
  const [showAiResultsModal, setShowAiResultsModal] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [modalSelectedStocks, setModalSelectedStocks] = useState([]);
  const [filters, setFilters] = useState({
    sector: '',
    min_rsi: '',
    max_rsi: '',
    min_price_change_7d: '',
    max_price_change_7d: '',
  });

  useEffect(() => {
    fetchStocks();
  }, [filters]);

  const fetchStocks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await getStocks(params.toString());
      setStocks(response.data);
    } catch (error) {
      console.error('Error fetching stocks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoScreen = () => {
    setShowStockSelector(true);
    setModalSearchQuery('');
    setModalSelectedStocks([]);
  };

  const handleStartScreening = async () => {
    if (modalSelectedStocks.length === 0) {
      alert('Please select at least 1 stock to analyze');
      return;
    }

    setShowStockSelector(false);

    try {
      setAiLoading(true);
      setUseAi(true);
      setAiScreeningProgress({ status: 'running' });

      const response = await autoScreener({
        symbols: modalSelectedStocks,
      });

      if (response.data.error) {
        console.error('AI screening error:', response.data.error);
        alert('AI screening failed: ' + response.data.error);
        setAiScreeningProgress({ status: 'failed', error: response.data.error });
      } else {
        // Start polling for progress
        startProgressPolling();
      }
    } catch (error) {
      console.error('Error running AI screener:', error);
      alert(`AI screening failed: ${error.response?.data?.error || error.message}. Please check that the backend server is running and Ollama is accessible.`);
      setAiScreeningProgress({ status: 'failed', error: error.message });
    }
  };

  const startProgressPolling = () => {
    const pollInterval = setInterval(async () => {
      try {
        const progressRes = await getAIScreeningProgress();
        setAiScreeningProgress(progressRes.data);

        if (progressRes.data.status === 'completed') {
          clearInterval(pollInterval);
          setAiLoading(false);
          // Store AI results separately and rank them
          if (progressRes.data.result && progressRes.data.result.recommendations) {
            // Rank stocks: BUY > HOLD > SELL, then by risk level (LOW > MEDIUM > HIGH)
            const ratingOrder = { 'BUY': 3, 'HOLD': 2, 'SELL': 1 };
            const riskOrder = { 'LOW': 3, 'MEDIUM': 2, 'HIGH': 1 };

            const rankedRecommendations = progressRes.data.result.recommendations.sort((a, b) => {
              const ratingDiff = (ratingOrder[b.rating] || 0) - (ratingOrder[a.rating] || 0);
              if (ratingDiff !== 0) return ratingDiff;
              return (riskOrder[b.risk_level] || 0) - (riskOrder[a.risk_level] || 0);
            });

            // Add rank to recommendations
            const rankedResults = rankedRecommendations.map((rec, index) => ({
              ...rec,
              rank: index + 1
            }));

            setAiResults(rankedResults);
            setSelectedStocks([]);
            setShowAiResultsModal(true);

            // Find best stock (highest rank)
            const bestStock = rankedResults[0];

            // Show summary with best stock recommendation
            if (bestStock) {
              alert(`AI Screening Complete!\n\nBest Stock: ${bestStock.symbol}\nDirection: ${bestStock.direction}\nRating: ${bestStock.rating}\nRisk: ${bestStock.risk_level}\nReasoning: ${bestStock.reasoning}`);
            }
          }
        } else if (progressRes.data.status === 'failed') {
          clearInterval(pollInterval);
          setAiLoading(false);
          alert('AI screening failed: ' + (progressRes.data.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error polling progress:', error);
        clearInterval(pollInterval);
        setAiLoading(false);
      }
    }, 3000);
  };

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const handleClearFilters = () => {
    setFilters({
      sector: '',
      min_rsi: '',
      max_rsi: '',
      min_price_change_7d: '',
      max_price_change_7d: '',
    });
  };

  const handleStockSelection = (symbol) => {
    setSelectedStocks(prev =>
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const handleModalStockSelection = (symbol) => {
    setModalSelectedStocks(prev => {
      if (prev.includes(symbol)) {
        return prev.filter(s => s !== symbol);
      } else if (prev.length < 5) {
        return [...prev, symbol];
      } else {
        alert('You can select up to 5 stocks for AI screening');
        return prev;
      }
    });
  };

  const handleAddToWatchlist = async () => {
    if (selectedStocks.length === 0) return;

    try {
      for (const symbol of selectedStocks) {
        await addToWatchlist(symbol);
      }
      alert(`Successfully added ${selectedStocks.length} stocks to watchlist`);
      setSelectedStocks([]);
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      alert('Failed to add stocks to watchlist');
    }
  };

  const getRatingColor = (rating) => {
    if (!rating) return '';
    switch (rating.toUpperCase()) {
      case 'BUY': return 'text-green-500';
      case 'SELL': return 'text-red-500';
      case 'HOLD': return 'text-yellow-500';
      default: return '';
    }
  };

  const getDirectionColor = (direction) => {
    if (!direction) return '';
    switch (direction.toUpperCase()) {
      case 'UP': return 'text-green-500';
      case 'DOWN': return 'text-red-500';
      case 'SIDEWAYS': return 'text-gray-500';
      default: return '';
    }
  };

  const getRiskColor = (risk) => {
    if (!risk) return '';
    switch (risk.toUpperCase()) {
      case 'LOW': return 'text-green-500';
      case 'MEDIUM': return 'text-yellow-500';
      case 'HIGH': return 'text-red-500';
      default: return '';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Search className="h-6 w-6" />
          Stock Screener
        </h1>
        <button
          onClick={handleAutoScreen}
          disabled={aiLoading}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {aiLoading ? (
            <>
              <div className="spinner h-4 w-4" />
              {aiScreeningProgress?.status === 'running' ? 'AI Screening...' : 'AI Analyzing...'}
            </>
          ) : (
            <>
              <Brain className="h-4 w-4" />
              Auto Screen
            </>
          )}
        </button>
      </div>

      {/* AI Screening Progress */}
      {aiScreeningProgress && aiScreeningProgress.status === 'running' && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="spinner h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                AI Screening in Progress
              </span>
            </div>
            {aiScreeningProgress.stocks_screened !== undefined && aiScreeningProgress.total_stocks !== undefined && (
              <span className="text-sm text-purple-600 dark:text-purple-400">
                {aiScreeningProgress.stocks_screened}/{aiScreeningProgress.total_stocks} stocks
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {aiScreeningProgress.stocks_screened !== undefined && aiScreeningProgress.total_stocks !== undefined && (
            <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2.5 mb-3">
              <div
                className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${(aiScreeningProgress.stocks_screened / aiScreeningProgress.total_stocks) * 100}%` }}
              />
            </div>
          )}

          {/* Current Stock */}
          {aiScreeningProgress.current_stock && (
            <div className="text-sm text-purple-600 dark:text-purple-400">
              Currently analyzing: <span className="font-semibold">{aiScreeningProgress.current_stock}</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-[var(--color-card-bg)] rounded-lg p-4 mb-6 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <h2 className="font-semibold">Filters</h2>
          </div>
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-4 w-4" />
            Clear Filters
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Sector</label>
            <input
              type="text"
              name="sector"
              value={filters.sector}
              onChange={handleFilterChange}
              placeholder="e.g., Banking, Insurance"
              className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Min RSI (14)</label>
            <input
              type="number"
              name="min_rsi"
              value={filters.min_rsi}
              onChange={handleFilterChange}
              placeholder="0"
              className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max RSI (14)</label>
            <input
              type="number"
              name="max_rsi"
              value={filters.max_rsi}
              onChange={handleFilterChange}
              placeholder="100"
              className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Min 7D Change %</label>
            <input
              type="number"
              name="min_price_change_7d"
              value={filters.min_price_change_7d}
              onChange={handleFilterChange}
              placeholder="-100"
              className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max 7D Change %</label>
            <input
              type="number"
              name="max_price_change_7d"
              value={filters.max_price_change_7d}
              onChange={handleFilterChange}
              placeholder="100"
              className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text)]"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner h-8 w-8" />
        </div>
      ) : stocks.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          No stocks found matching your filters
        </div>
      ) : (
        <div className="bg-[var(--color-card-bg)] rounded-lg border border-[var(--color-border)] overflow-hidden">
          <table className="w-full">
            <thead className="bg-[var(--color-table-header-bg)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Symbol</th>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Sector</th>
                <th className="px-4 py-3 text-right font-semibold">RSI (14)</th>
                <th className="px-4 py-3 text-right font-semibold">MA (20)</th>
                <th className="px-4 py-3 text-right font-semibold">MA (50)</th>
                <th className="px-4 py-3 text-right font-semibold">7D Change %</th>
                <th className="px-4 py-3 text-right font-semibold">30D Change %</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock) => (
                <tr key={stock.symbol} className="border-t border-[var(--color-border)] hover:bg-[var(--color-hover-bg)]">
                  <td className="px-4 py-3 font-medium">
                    <a href={`/stocks/${stock.symbol}`} className="text-[var(--color-link)] hover:underline">
                      {stock.symbol}
                    </a>
                  </td>
                  <td className="px-4 py-3">{stock.name}</td>
                  <td className="px-4 py-3 text-sm">{stock.sector || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    {stock.rsi_14 ? (
                      <span className={stock.rsi_14 > 70 ? 'text-red-500' : stock.rsi_14 < 30 ? 'text-green-500' : ''}>
                        {stock.rsi_14.toFixed(2)}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">{stock.ma_20 ? stock.ma_20.toFixed(2) : '-'}</td>
                  <td className="px-4 py-3 text-right">{stock.ma_50 ? stock.ma_50.toFixed(2) : '-'}</td>
                  <td className="px-4 py-3 text-right">
                    {stock.price_change_pct_7d !== null ? (
                      <span className={`flex items-center justify-end gap-1 ${stock.price_change_pct_7d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {stock.price_change_pct_7d >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        {stock.price_change_pct_7d.toFixed(2)}%
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {stock.price_change_pct_30d !== null ? (
                      <span className={`flex items-center justify-end gap-1 ${stock.price_change_pct_30d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {stock.price_change_pct_30d >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        {stock.price_change_pct_30d.toFixed(2)}%
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stock Selector Modal */}
      {showStockSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Select Stocks to Analyze</h2>
              <button
                onClick={() => setShowStockSelector(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search stocks by symbol or name..."
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {modalSelectedStocks.length}/5 stocks selected
              </div>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              {stocks
                .filter(stock =>
                  modalSearchQuery === '' ||
                  stock.symbol.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
                  stock.name.toLowerCase().includes(modalSearchQuery.toLowerCase())
                )
                .map((stock) => (
                  <div
                    key={stock.symbol}
                    className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={modalSelectedStocks.includes(stock.symbol)}
                      onChange={() => handleModalStockSelection(stock.symbol)}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{stock.symbol}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{stock.name}</span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">{stock.sector || 'Unknown Sector'}</div>
                    </div>
                  </div>
                ))}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowStockSelector(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartScreening}
                disabled={modalSelectedStocks.length === 0}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Brain className="h-4 w-4" />
                Start Screening ({modalSelectedStocks.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Results Modal */}
      {showAiResultsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Screened Results
                </h2>
                <button
                  onClick={() => setShowAiResultsModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              <table className="w-full">
                <thead className="bg-purple-100 dark:bg-purple-800/30 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold w-12">Select</th>
                    <th className="px-4 py-3 text-left font-semibold">Rank</th>
                    <th className="px-4 py-3 text-left font-semibold">Symbol</th>
                    <th className="px-4 py-3 text-left font-semibold">Direction</th>
                    <th className="px-4 py-3 text-left font-semibold">Rating</th>
                    <th className="px-4 py-3 text-left font-semibold">Risk</th>
                    <th className="px-4 py-3 text-left font-semibold">Reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  {aiResults.map((result) => (
                    <tr key={result.symbol} className="border-t border-purple-200 dark:border-purple-800 hover:bg-purple-100/50 dark:hover:bg-purple-800/30">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedStocks.includes(result.symbol)}
                          onChange={() => handleStockSelection(result.symbol)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-purple-900 dark:text-purple-100">#{result.rank}</td>
                      <td className="px-4 py-3 font-medium">
                        <a href={`/stocks/${result.symbol}`} className="text-purple-700 dark:text-purple-300 hover:underline">
                          {result.symbol}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${getDirectionColor(result.direction)}`}>
                          {result.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          <span className={`font-semibold ${getRatingColor(result.rating)}`}>
                            {result.rating}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${getRiskColor(result.risk_level)}`}>
                          {result.risk_level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs">
                        {result.reasoning}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-purple-200 dark:border-purple-800 flex justify-between items-center">
              <div className="text-sm text-purple-700 dark:text-purple-300">
                {selectedStocks.length > 0 ? `${selectedStocks.length} selected` : 'Select stocks to add to watchlist'}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAiResultsModal(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
                {selectedStocks.length > 0 && (
                  <button
                    onClick={handleAddToWatchlist}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add to Watchlist ({selectedStocks.length})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
