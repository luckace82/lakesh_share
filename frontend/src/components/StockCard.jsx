import { Link } from 'react-router-dom';
import { Sparklines, SparklinesLine } from 'react-sparklines';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

export default function StockCard({ stock, history, variant = 'detailed' }) {
  const price = stock.latest_price;
  const priceValue = price ? (price.ltp || price.close) : null;
  const changeValue = price ? (price.change || 0) : 0;
  const isUp = parseFloat(changeValue) >= 0;

  const sparklineData = history && Array.isArray(history)
    ? history.slice(-30).map(h => parseFloat(h.close))
    : [];

  const hasTrend = sparklineData.length >= 2;
  const trendUp = hasTrend
    ? sparklineData[sparklineData.length - 1] >= sparklineData[0]
    : isUp;

  return (
    <div className="card p-4 hover:border-[var(--color-brand)] transition-colors">
      <Link to={`/stocks/${stock.symbol}`} className="no-underline block">
        <div className="flex items-start justify-between mb-2">
          <div>
            <span className="text-[18px] font-bold font-mono text-[var(--color-primary-text)] hover:text-[var(--color-brand)] transition-colors">
              {stock.symbol}
            </span>
            <p className="text-[var(--color-secondary-text)] text-sm mt-0.5 truncate">{stock.name}</p>
          </div>
          {variant === 'detailed' && priceValue && (
            <div className="text-right">
              <span className="text-[20px] font-bold font-mono text-[var(--color-primary-text)]">
                {parseFloat(priceValue).toFixed(2)}
              </span>
              <div className={`flex items-center justify-end gap-1 text-xs font-medium ${isUp ? 'text-[var(--color-gain)]' : 'text-[var(--color-loss)]'}`}>
                {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{parseFloat(changeValue).toFixed(2)}</span>
                {price.change_percent && (
                  <span>({parseFloat(price.change_percent).toFixed(2)}%)</span>
                )}
              </div>
            </div>
          )}
        </div>

        {sparklineData.length > 0 && (
          <div className="h-8 mb-2">
            <Sparklines data={sparklineData} width={200} height={32} margin={0}>
              <SparklinesLine color={trendUp ? 'var(--color-gain)' : 'var(--color-loss)'} />
            </Sparklines>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-[var(--color-secondary-text)]">
          {stock.sector ? (
            <span className="badge badge-info">{stock.sector}</span>
          ) : (
            <span>Sector: N/A</span>
          )}
          {variant === 'simple' && stock.daily_count ? (
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {stock.daily_count}d
            </span>
          ) : variant === 'detailed' && stock.daily_count ? (
            <span>{stock.daily_count} records</span>
          ) : null}
        </div>
      </Link>
    </div>
  );
}
