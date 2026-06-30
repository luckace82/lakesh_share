import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

function HistogramBar(props) {
  const { x, y, width, height, payload } = props;
  const val = payload?.histogram;
  if (val === null || val === undefined) return null;
  const color = val >= 0 ? 'var(--color-gain)' : 'var(--color-loss)';
  return <rect x={x} y={y} width={width} height={Math.abs(height)} fill={color} opacity={0.7} rx={1} />;
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

export default function MACDChart({ data }) {
  return (
    <div className="card">
      <h3 className="text-sm font-medium text-[var(--color-secondary-text)] mb-4">MACD (12, 26, 9)</h3>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" tick={{ fill: 'var(--color-secondary-text)', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fill: 'var(--color-secondary-text)', fontSize: 11 }} />
          <Tooltip content={<MACDTooltip />} />
          <ReferenceLine y={0} stroke="var(--color-border)" />
          <Bar dataKey="histogram" name="Histogram" shape={<HistogramBar />} />
          <Line type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="MACD" />
          <Line type="monotone" dataKey="signal" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Signal" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
