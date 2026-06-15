import { useState, useMemo } from 'react';
import { FileDown } from 'lucide-react';
import { downloadCSV } from '../api/client';
import { avg, calcRSI, calcMACD, calcStochastic, calcWilliamsR, calcIchimoku } from './charts-tab/chart-utils';
import PriceMAChart from './charts-tab/PriceMAChart';
import OHLCChart from './charts-tab/OHLCChart';
import VolumeChart from './charts-tab/VolumeChart';
import RSIChart from './charts-tab/RSIChart';
import MACDChart from './charts-tab/MACDChart';
import StochasticChart from './charts-tab/StochasticChart';
import WilliamsRChart from './charts-tab/WilliamsRChart';
import IchimokuChart from './charts-tab/IchimokuChart';

const RANGES = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: 0 },
];

export default function ChartsTab({ symbol, history }) {
  const [range, setRange] = useState('6M');

  const data = useMemo(() => {
    if (!history.length) return [];
    const allCloses = history.map((h) => parseFloat(h.close));
    const rangeDays = RANGES.find((r) => r.label === range)?.days || 0;
    const sliced = rangeDays > 0 ? history.slice(-rangeDays) : history;

    return sliced.map((d, i) => {
      const idx = history.length - sliced.length + i;
      const close = parseFloat(d.close);
      const open = parseFloat(d.open);
      const high = parseFloat(d.high);
      const low = parseFloat(d.low);

      const ma20 = idx >= 19 ? avg(allCloses.slice(idx - 19, idx + 1)) : null;
      const ma50 = idx >= 49 ? avg(allCloses.slice(idx - 49, idx + 1)) : null;

      let bbUpper = null, bbLower = null;
      if (idx >= 19) {
        const slice20 = allCloses.slice(idx - 19, idx + 1);
        const mean = avg(slice20);
        const stdDev = Math.sqrt(slice20.reduce((s, v) => s + (v - mean) ** 2, 0) / 20);
        bbUpper = mean + 2 * stdDev;
        bbLower = mean - 2 * stdDev;
      }

      const rsi = idx >= 14 ? calcRSI(allCloses.slice(0, idx + 1), 14) : null;
      const macd = calcMACD(allCloses.slice(0, idx + 1));
      const stochastic = idx >= 14 ? calcStochastic(history.slice(idx - 13, idx + 1)) : null;
      const williamsR = idx >= 14 ? calcWilliamsR(history.slice(idx - 13, idx + 1)) : null;
      const ichimoku = idx >= 52 ? calcIchimoku(history.slice(0, idx + 1)) : null;
      const isUp = close >= open;

      return {
        date: d.date, open, high, low, close, volume: d.volume,
        ma20, ma50, bbUpper, bbLower, rsi,
        macd: macd?.macd ?? null, signal: macd?.signal ?? null, histogram: macd?.histogram ?? null,
        stochasticK: stochastic?.k ?? null, stochasticD: stochastic?.d ?? null,
        williamsR: williamsR ?? null,
        ichimokuTenkan: ichimoku?.tenkan ?? null,
        ichimokuKijun: ichimoku?.kijun ?? null,
        ichimokuSenkouA: ichimoku?.senkouA ?? null,
        ichimokuSenkouB: ichimoku?.senkouB ?? null,
        candleBody: [Math.min(open, close), Math.max(open, close)],
        isUp,
      };
    });
  }, [history, range]);

  if (!history.length) {
    return (
      <div className="card border-dashed flex flex-col items-center justify-center p-12">
        <p className="text-[var(--color-secondary-text)]">No data available. Scrape data first to see charts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="relative flex gap-1 bg-[var(--color-card-bg)] p-1 rounded-lg border border-[var(--color-border)]">
          <div
            className="absolute top-1 bottom-1 rounded bg-[var(--color-brand)] transition-transform duration-200 ease-out"
            style={{
              width: `${100 / RANGES.length}%`,
              transform: `translateX(${RANGES.findIndex(r => r.label === range) * 100}%)`
            }}
          />
          {RANGES.map((r) => (
            <button key={r.label} onClick={() => setRange(r.label)}
              className={`relative z-10 flex-1 px-3 py-1.5 rounded text-sm font-medium border-0 cursor-pointer transition-colors ${
                range === r.label ? 'text-white' : 'text-[var(--color-secondary-text)] hover:text-[var(--color-primary-text)]'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
        <button onClick={() => downloadCSV(symbol, history)}
          className="btn-secondary flex items-center gap-2 text-sm">
          <FileDown className="h-4 w-4" />
          Download CSV
        </button>
      </div>

      <PriceMAChart data={data} />
      <OHLCChart data={data} />
      <VolumeChart data={data} />
      <RSIChart data={data} />
      <MACDChart data={data} />
      <StochasticChart data={data} />
      <WilliamsRChart data={data} />
      <IchimokuChart data={data} />
    </div>
  );
}
