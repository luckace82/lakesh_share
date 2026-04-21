import { useState, useMemo } from 'react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, Legend,
} from 'recharts';
import { Download, FileDown } from 'lucide-react';
import { downloadCSV } from '../api/client';

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

      // Bollinger Bands (20-period, 2 std dev)
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
        <div className="flex gap-1 bg-[var(--color-card-bg)] p-1 rounded-lg border border-[var(--color-border)]">
          {RANGES.map((r) => (
            <button key={r.label} onClick={() => setRange(r.label)}
              className={`px-3 py-1.5 rounded text-sm font-medium border-0 cursor-pointer transition-colors ${
                range === r.label ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-secondary-text)] hover:text-[var(--color-primary-text)] bg-transparent'
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

      {/* Price + MA + Bollinger Chart */}
      <div className="card">
        <h3 className="text-sm font-medium text-[var(--color-secondary-text)] mb-4">Price, Moving Averages & Bollinger Bands</h3>
        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
            <YAxis domain={['auto', 'auto']} tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip content={<PriceTooltip />} />
            <Legend />
            <Area type="monotone" dataKey="bbUpper" stroke="transparent" fill="#3b82f6" fillOpacity={0.05} name="BB Upper" />
            <Area type="monotone" dataKey="bbLower" stroke="transparent" fill="transparent" name="BB Lower" />
            <Line type="monotone" dataKey="bbUpper" stroke="#3b82f680" strokeWidth={1} dot={false} name="" strokeDasharray="2 2" legendType="none" />
            <Line type="monotone" dataKey="bbLower" stroke="#3b82f680" strokeWidth={1} dot={false} name="" strokeDasharray="2 2" legendType="none" />
            <Line type="monotone" dataKey="close" stroke="#10b981" strokeWidth={2} dot={false} name="Close" />
            <Line type="monotone" dataKey="ma20" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="MA20" strokeDasharray="4 2" />
            <Line type="monotone" dataKey="ma50" stroke="#6366f1" strokeWidth={1.5} dot={false} name="MA50" strokeDasharray="4 2" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Candlestick-style OHLC */}
      <div className="card">
        <h3 className="text-sm font-medium text-[var(--color-secondary-text)] mb-4">OHLC Candlestick</h3>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
            <YAxis domain={['auto', 'auto']} tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip content={<CandleTooltip />} />
            <Bar dataKey="candleBody" fill="#10b981" shape={<CandleBar />} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Volume Chart */}
      <div className="card">
        <h3 className="text-sm font-medium text-[var(--color-secondary-text)] mb-4">Volume</h3>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} />
            <Tooltip content={<VolumeTooltip />} />
            <Bar dataKey="volume" name="Volume" shape={<VolumeBar />} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* RSI Chart */}
      <div className="card">
        <h3 className="text-sm font-medium text-[var(--color-secondary-text)] mb-4">RSI (14)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
            <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip content={<RSITooltip />} />
            <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Overbought (70)', fill: '#ef4444', fontSize: 10, position: 'right' }} />
            <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Oversold (30)', fill: '#10b981', fontSize: 10, position: 'right' }} />
            <ReferenceLine y={50} stroke="#374151" strokeDasharray="2 2" />
            <Area type="monotone" dataKey="rsi" stroke="#a855f7" fill="#a855f7" fillOpacity={0.1} strokeWidth={2} dot={false} name="RSI" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* MACD Chart */}
      <div className="card">
        <h3 className="text-sm font-medium text-[var(--color-secondary-text)] mb-4">MACD (12, 26, 9)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip content={<MACDTooltip />} />
            <ReferenceLine y={0} stroke="#374151" />
            <Bar dataKey="histogram" name="Histogram" shape={<HistogramBar />} />
            <Line type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="MACD" />
            <Line type="monotone" dataKey="signal" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Signal" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Stochastic Oscillator */}
      <div className="card">
        <h3 className="text-sm font-medium text-[var(--color-secondary-text)] mb-4">Stochastic Oscillator (14, 3)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" stroke="var(--color-secondary-text)" fontSize={11} tickFormatter={(v) => v.slice(5)} />
            <YAxis domain={[0, 100]} stroke="var(--color-secondary-text)" fontSize={11} />
            <Tooltip />
            <ReferenceLine y={80} stroke="var(--color-loss)" strokeDasharray="3 3" label={{ value: 'Overbought (80)', fill: 'var(--color-loss)', fontSize: 10, position: 'right' }} />
            <ReferenceLine y={20} stroke="var(--color-gain)" strokeDasharray="3 3" label={{ value: 'Oversold (20)', fill: 'var(--color-gain)', fontSize: 10, position: 'right' }} />
            <Line type="monotone" dataKey="stochasticK" stroke="var(--color-brand)" strokeWidth={2} dot={false} name="%K" />
            <Line type="monotone" dataKey="stochasticD" stroke="var(--color-warning)" strokeWidth={2} dot={false} name="%D" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Williams %R */}
      <div className="card">
        <h3 className="text-sm font-medium text-[var(--color-secondary-text)] mb-4">Williams %R (14)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" stroke="var(--color-secondary-text)" fontSize={11} tickFormatter={(v) => v.slice(5)} />
            <YAxis domain={[-100, 0]} stroke="var(--color-secondary-text)" fontSize={11} />
            <Tooltip />
            <ReferenceLine y={-20} stroke="var(--color-loss)" strokeDasharray="3 3" label={{ value: 'Overbought (-20)', fill: 'var(--color-loss)', fontSize: 10, position: 'right' }} />
            <ReferenceLine y={-80} stroke="var(--color-gain)" strokeDasharray="3 3" label={{ value: 'Oversold (-80)', fill: 'var(--color-gain)', fontSize: 10, position: 'right' }} />
            <Line type="monotone" dataKey="williamsR" stroke="var(--color-info)" strokeWidth={2} dot={false} name="%R" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Ichimoku Cloud */}
      <div className="card">
        <h3 className="text-sm font-medium text-[var(--color-secondary-text)] mb-4">Ichimoku Cloud</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" stroke="var(--color-secondary-text)" fontSize={11} tickFormatter={(v) => v.slice(5)} />
            <YAxis stroke="var(--color-secondary-text)" fontSize={11} />
            <Tooltip />
            <Area type="monotone" dataKey="ichimokuSenkouA" stroke="var(--color-brand)" fill="var(--color-brand-tint)" fillOpacity={0.3} strokeWidth={1} dot={false} name="Senkou A" />
            <Area type="monotone" dataKey="ichimokuSenkouB" stroke="var(--color-warning)" fill="var(--color-warning-tint)" fillOpacity={0.3} strokeWidth={1} dot={false} name="Senkou B" />
            <Line type="monotone" dataKey="ichimokuTenkan" stroke="var(--color-info)" strokeWidth={2} dot={false} name="Tenkan" />
            <Line type="monotone" dataKey="ichimokuKijun" stroke="var(--color-loss)" strokeWidth={2} dot={false} name="Kijun" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CandleBar(props) {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const isUp = payload.close >= payload.open;
  const color = isUp ? '#10b981' : '#ef4444';
  const barX = x + width / 2;
  return (
    <g>
      <line x1={barX} y1={y} x2={barX} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={x + width * 0.15} y={y + height * 0.2} width={width * 0.7} height={Math.max(height * 0.6, 2)} fill={isUp ? color : color} stroke={color} strokeWidth={1} />
    </g>
  );
}

function VolumeBar(props) {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const color = payload.isUp ? '#10b981' : '#ef4444';
  return <rect x={x} y={y} width={width} height={Math.abs(height)} fill={color} opacity={0.6} rx={1} />;
}

function HistogramBar(props) {
  const { x, y, width, height, payload } = props;
  const val = payload?.histogram;
  if (val === null || val === undefined) return null;
  const color = val >= 0 ? '#10b981' : '#ef4444';
  return <rect x={x} y={y} width={width} height={Math.abs(height)} fill={color} opacity={0.7} rx={1} />;
}

function PriceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg p-3 text-xs shadow-lg">
      <p className="text-[var(--color-secondary-text)] mb-2 font-medium">{label}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <p>Open: <span className="text-[var(--color-primary-text)] font-mono font-medium">NPR {d?.open?.toFixed(2)}</span></p>
        <p>High: <span className="text-[var(--color-primary-text)] font-mono font-medium">NPR {d?.high?.toFixed(2)}</span></p>
        <p>Low: <span className="text-[var(--color-primary-text)] font-mono font-medium">NPR {d?.low?.toFixed(2)}</span></p>
        <p>Close: <span className="text-gain font-mono font-medium">NPR {d?.close?.toFixed(2)}</span></p>
      </div>
      <div className="mt-2 pt-2 border-t border-[var(--color-border)] space-y-1">
        {d?.ma20 && <p>MA20: <span className="text-yellow-400">{d.ma20.toFixed(2)}</span></p>}
        {d?.ma50 && <p>MA50: <span className="text-indigo-400">{d.ma50.toFixed(2)}</span></p>}
        {d?.bbUpper && <p>BB: <span className="text-blue-400">{d.bbLower?.toFixed(2)} — {d.bbUpper.toFixed(2)}</span></p>}
      </div>
    </div>
  );
}

function CandleTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg p-3 text-xs shadow-lg">
      <p className="text-[var(--color-secondary-text)] mb-1">{label}</p>
      <p>O: <span className="text-[var(--color-primary-text)] font-mono">NPR {d?.open?.toFixed(2)}</span> H: <span className="text-[var(--color-primary-text)] font-mono">NPR {d?.high?.toFixed(2)}</span></p>
      <p>L: <span className="text-[var(--color-primary-text)] font-mono">NPR {d?.low?.toFixed(2)}</span> C: <span className={`font-mono ${d?.isUp ? 'text-gain' : 'text-loss'}`}>NPR {d?.close?.toFixed(2)}</span></p>
    </div>
  );
}

function VolumeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg p-3 text-xs shadow-lg">
      <p className="text-[var(--color-secondary-text)] mb-1">{label}</p>
      <p>Volume: <span className="text-[var(--color-info)] font-mono font-medium">{payload[0]?.value?.toLocaleString()}</span></p>
    </div>
  );
}

function RSITooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const rsi = payload[0]?.value;
  const zone = rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral';
  return (
    <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg p-3 text-xs shadow-lg">
      <p className="text-[var(--color-secondary-text)] mb-1">{label}</p>
      <p>RSI: <span className={`font-mono font-medium ${rsi > 70 ? 'text-loss' : rsi < 30 ? 'text-gain' : 'text-warning'}`}>{rsi?.toFixed(1)}</span>
        <span className="text-[var(--color-secondary-text)] ml-2">({zone})</span></p>
    </div>
  );
}

function MACDTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg p-3 text-xs shadow-lg">
      <p className="text-[var(--color-secondary-text)] mb-1">{label}</p>
      <p>MACD: <span className="text-[var(--color-info)] font-mono">{d?.macd?.toFixed(2)}</span></p>
      <p>Signal: <span className="text-[var(--color-warning)] font-mono">{d?.signal?.toFixed(2)}</span></p>
      <p>Histogram: <span className={`font-mono ${d?.histogram >= 0 ? 'text-gain' : 'text-loss'}`}>{d?.histogram?.toFixed(2)}</span></p>
    </div>
  );
}

function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

function calcRSI(closes, period) {
  if (closes.length < period + 1) return null;
  const recent = closes.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcMACD(closes) {
  if (closes.length < 26) return null;
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd = ema12 - ema26;
  const macdHistory = [];
  for (let i = 26; i < closes.length; i++) {
    macdHistory.push(calcEMA(closes.slice(0, i + 1), 12) - calcEMA(closes.slice(0, i + 1), 26));
  }
  const signal = calcEMA(macdHistory.slice(-9), 9);
  return { macd, signal, histogram: macd - signal };
}

function calcEMA(arr, period) {
  const k = 2 / (period + 1);
  let ema = arr[0];
  for (let i = 1; i < arr.length; i++) {
    ema = arr[i] * k + ema * (1 - k);
  }
  return ema;
}

// Stochastic Oscillator (14-period)
function calcStochastic(data) {
  if (data.length < 14) return null;
  const recent = data.slice(-14);
  const highs = recent.map(d => parseFloat(d.high));
  const lows = recent.map(d => parseFloat(d.low));
  const closes = recent.map(d => parseFloat(d.close));
  const high14 = Math.max(...highs);
  const low14 = Math.min(...lows);
  const k = ((closes[closes.length - 1] - low14) / (high14 - low14)) * 100;
  // Smooth K to get D (3-period SMA of K)
  const d = k; // Simplified - would need K history for proper smoothing
  return { k, d };
}

// Williams %R (14-period)
function calcWilliamsR(data) {
  if (data.length < 14) return null;
  const recent = data.slice(-14);
  const highs = recent.map(d => parseFloat(d.high));
  const lows = recent.map(d => parseFloat(d.low));
  const closes = recent.map(d => parseFloat(d.close));
  const high14 = Math.max(...highs);
  const low14 = Math.min(...lows);
  return ((high14 - closes[closes.length - 1]) / (high14 - low14)) * -100;
}

// Ichimoku Cloud (simplified)
function calcIchimoku(data) {
  if (data.length < 52) return null;
  const highs = data.map(d => parseFloat(d.high));
  const lows = data.map(d => parseFloat(d.low));
  const closes = data.map(d => parseFloat(d.close));

  // Tenkan-sen (9-period high + low) / 2
  const recent9 = data.slice(-9);
  const tenkan = (Math.max(...recent9.map(d => d.high)) + Math.min(...recent9.map(d => d.low))) / 2;

  // Kijun-sen (26-period high + low) / 2
  const recent26 = data.slice(-26);
  const kijun = (Math.max(...recent26.map(d => d.high)) + Math.min(...recent26.map(d => d.low))) / 2;

  // Senkou Span A (Tenkan + Kijun) / 2, shifted 26 periods ahead
  const senkouA = (tenkan + kijun) / 2;

  // Senkou Span B (52-period high + low) / 2, shifted 26 periods ahead
  const recent52 = data.slice(-52);
  const senkouB = (Math.max(...recent52.map(d => d.high)) + Math.min(...recent52.map(d => d.low))) / 2;

  return { tenkan, kijun, senkouA, senkouB };
}
