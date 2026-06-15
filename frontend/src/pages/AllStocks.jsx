import { useState, useEffect, useCallback } from 'react';
import { getAllStocksWithPrices, getStockHistory } from '../api/client';
import StockCard from '../components/StockCard';
import { Search } from 'lucide-react';

export default function AllStocks() {
  const [stocks, setStocks] = useState([]);
  const [stockHistories, setStockHistories] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('');

  const fetchStocks = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (sector) params.sector = sector;
      
      const res = await getAllStocksWithPrices(params);
      setStocks(res.data);

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
      setStockHistories(historyMap);
    } catch (error) {
      console.error('Error fetching stocks:', error);
    } finally {
      setLoading(false);
    }
  }, [search, sector]);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner h-8 w-8" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-[var(--color-primary-text)] mb-4">
          All Stocks
        </h1>
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-secondary-text)]" />
            <input
              type="text"
              placeholder="Search stocks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-primary-text)] placeholder-[var(--color-secondary-text)] focus:outline-none focus:border-[var(--color-brand)]"
            />
          </div>
          <input
            type="text"
            placeholder="Filter by sector..."
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-primary-text)] placeholder-[var(--color-secondary-text)] focus:outline-none focus:border-[var(--color-brand)]"
          />
        </div>
        <p className="text-[var(--color-secondary-text)]">
          {stocks.length} stock{stocks.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {stocks.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-12">
          <p className="text-[var(--color-secondary-text)] mb-2">No stocks found</p>
          <p className="text-[var(--color-secondary-text)] text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {stocks.map((stock) => (
            <StockCard key={stock.id} stock={stock} history={stockHistories[stock.symbol] || []} />
          ))}
        </div>
      )}
    </div>
  );
}
