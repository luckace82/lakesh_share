import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function CandleBar(props) {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const isUp = payload.close >= payload.open;
  const color = isUp ? 'var(--color-gain)' : 'var(--color-loss)';
  const barX = x + width / 2;
  return (
    <g>
      <line x1={barX} y1={y} x2={barX} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={x + width * 0.15} y={y + height * 0.2} width={width * 0.7} height={Math.max(height * 0.6, 2)} fill={color} stroke={color} strokeWidth={1} />
    </g>
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

export default function OHLCChart({ data }) {
  return (
    <div className="card">
      <h3 className="text-sm font-medium text-[var(--color-secondary-text)] mb-4">OHLC Candlestick</h3>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" tick={{ fill: 'var(--color-secondary-text)', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--color-secondary-text)', fontSize: 11 }} />
          <Tooltip content={<CandleTooltip />} />
          <Bar dataKey="candleBody" fill="var(--color-gain)" shape={<CandleBar />} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
