import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getAllStocksWithPrices } from '../api/client';
import { TrendingUp, TrendingDown, Search } from 'lucide-react';

function StockCard({ stock }) {
  const price = stock.latest_price;
  const isUp = price && price.change && parseFloat(price.change) >= 0;

  return (
    <div className="card p-4 hover:border-[var(--color-brand)] transition-colors">
      <Link to={`/stock/${stock.symbol}`} className="no-underline">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-[18px] font-bold font-mono text-[var(--color-primary-text)] hover:text-[var(--color-brand)] transition-colors">{stock.symbol}</span>
            <p className="text-[var(--color-secondary-text)] text-sm">{stock.name}</p>
          </div>
          {price ? (
            <div className="text-right">
              <span className="text-[24px] font-bold font-mono text-[var(--color-primary-text)]">
                {parseFloat(price.ltp).toFixed(2)}
              </span>
              <div className={`flex items-center gap-1 text-sm font-medium ${isUp ? 'text-[var(--color-gain)]' : 'text-[var(--color-loss)]'}`}>
                {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{parseFloat(price.change).toFixed(2)}</span>
                <span>({parseFloat(price.change_percent).toFixed(2)}%)</span>
              </div>
            </div>
          ) : (
            <span className="text-[var(--color-secondary-text)] text-sm">No data</span>
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] text-[var(--color-secondary-text)]">
          <span>Sector: {stock.sector || 'N/A'}</span>
          {stock.daily_count && <span>{stock.daily_count} records</span>}
        </div>
      </Link>
    </div>
  );
}

export default function AllStocks() {
  const [stocks, setStocks] = useState([]);
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
    <div className="p-6">
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
            <StockCard key={stock.id} stock={stock} />
          ))}
        </div>
      )}
    </div>
  );
}
