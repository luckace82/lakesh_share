import { Link } from 'react-router-dom';
import { Sparklines, SparklinesLine, SparklinesBars } from 'react-sparklines';
import { X, TrendingUp, TrendingDown, Activity as VolumeIcon, RefreshCw } from 'lucide-react';

function calculateRSI(prices, period = 14) {
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
}

function checkVolumeSpike(history) {
  if (!history || !Array.isArray(history) || history.length < 11) return false;
  const volumes = history.slice(-11, -1).map(h => parseFloat(h.volume));
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const latestVolume = parseFloat(history[history.length - 1].volume);
  return latestVolume > avgVolume * 2;
}

export default function WatchlistCard({ item, history, onRemove, variant = 'compact' }) {
  const stock = item.stock;
  const price = item.latest_price;
  const priceValue = price ? (price.ltp || price.close) : null;
  const changeValue = price ? (price.change_percent || price.change_pct) : null;
  const isUp = price && parseFloat(price.change || 0) >= 0;

  const sparklineData = history && Array.isArray(history)
    ? history.slice(-20).map(h => parseFloat(h.close))
    : [];

  const rsi = history && Array.isArray(history) && history.length > 14
    ? calculateRSI(history.map(h => parseFloat(h.close)))
    : 50;

  const hasVolumeSpike = checkVolumeSpike(history);
  const isFull = variant === 'full';

  return (
    <div className={`card ${isFull ? 'p-6' : 'group'}`}>
      <div className={`flex items-start justify-between ${isFull ? 'mb-4' : 'mb-3'}`}>
        <Link to={`/stocks/${stock.symbol}`} className="no-underline flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-bold font-mono text-[var(--color-primary-text)] ${isFull ? 'text-[22px]' : 'text-[18px]'}`}>
              {stock.symbol}
            </span>
            {hasVolumeSpike && <VolumeIcon className="h-4 w-4 text-[var(--color-warning)]" title="Volume spike" />}
          </div>
          <p className="text-[var(--color-secondary-text)] text-sm mt-1 truncate">{stock.name}</p>
        </Link>
        <button
          onClick={() => onRemove(stock.symbol)}
          className="p-2 rounded-lg hover:bg-[var(--color-loss-tint)] text-[var(--color-secondary-text)] hover:text-[var(--color-loss)] border-0 bg-transparent cursor-pointer"
          title="Remove from watchlist"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Sparkline */}
      <div className={`${isFull ? 'h-16 mb-4 flex items-center justify-center' : 'mb-3'}`}>
        {sparklineData.length > 0 ? (
          <Sparklines
            data={sparklineData}
            width={isFull ? 200 : 100}
            height={isFull ? 64 : 30}
            margin={isFull ? undefined : 0}
          >
            <SparklinesLine
              color={isUp ? 'var(--color-gain)' : 'var(--color-loss)'}
            />
            {isFull && (
              <SparklinesBars
                color={isUp ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)'}
              />
            )}
          </Sparklines>
        ) : (
          <div className="text-[var(--color-secondary-text)] text-xs">No trend data</div>
        )}
      </div>

      {/* Price + Change */}
      {priceValue ? (
        <div className={`flex items-end justify-between ${isFull ? 'mb-4' : 'mb-3'}`}>
          {isFull ? (
            <div className="flex items-end gap-2">
              <span className="text-[38px] font-bold font-mono text-[var(--color-primary-text)]">
                {parseFloat(priceValue).toFixed(2)}
              </span>
              <div className={`flex items-center gap-1 text-sm font-medium ${isUp ? 'text-[var(--color-gain)]' : 'text-[var(--color-loss)]'}`}>
                {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>{price.change ? parseFloat(price.change).toFixed(2) : '--'}</span>
                {changeValue && !isNaN(parseFloat(changeValue)) && (
                  <span>({parseFloat(changeValue).toFixed(2)}%)</span>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[16px] font-mono font-bold text-[var(--color-primary-text)]">
                NPR {parseFloat(priceValue).toLocaleString()}
              </p>
              <div className={`badge ${isUp ? 'badge-gain' : 'badge-loss'} mt-1`}>
                {isUp ? '+' : ''}{changeValue}%
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={`flex flex-col items-center justify-center ${isFull ? 'py-8' : 'py-4'}`}>
          <RefreshCw className="h-8 w-8 text-[var(--color-secondary-text)] mb-2" />
          <p className="text-[var(--color-secondary-text)] text-sm">No price data available</p>
        </div>
      )}

      {/* RSI Bar */}
      {priceValue && (
        <div className="flex items-center gap-2">
          <span className={`font-medium text-[var(--color-secondary-text)] ${isFull ? 'text-[12px]' : 'text-[10px]'}`}>RSI</span>
          <div className="flex-1 h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${rsi}%`,
                backgroundColor: rsi > 70 ? 'var(--color-loss)' : rsi < 30 ? 'var(--color-gain)' : 'var(--color-brand)'
              }}
            />
          </div>
          <span className={`font-mono text-[var(--color-secondary-text)] ${isFull ? 'text-[12px]' : 'text-[10px]'}`}>{rsi.toFixed(0)}</span>
          {isFull && (
            <span className={`text-[12px] font-medium ${rsi > 70 ? 'text-[var(--color-loss)]' : rsi < 30 ? 'text-[var(--color-gain)]' : 'text-[var(--color-secondary-text)]'}`}>
              {rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
