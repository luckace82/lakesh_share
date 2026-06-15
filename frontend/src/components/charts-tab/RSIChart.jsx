import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

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

export default function RSIChart({ data }) {
  return (
    <div className="card">
      <h3 className="text-sm font-medium text-[var(--color-secondary-text)] mb-4">RSI (14)</h3>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" tick={{ fill: 'var(--color-secondary-text)', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
          <YAxis domain={[0, 100]} tick={{ fill: 'var(--color-secondary-text)', fontSize: 11 }} />
          <Tooltip content={<RSITooltip />} />
          <ReferenceLine y={70} stroke="var(--color-loss)" strokeDasharray="3 3" label={{ value: 'Overbought (70)', fill: 'var(--color-loss)', fontSize: 10, position: 'right' }} />
          <ReferenceLine y={30} stroke="var(--color-gain)" strokeDasharray="3 3" label={{ value: 'Oversold (30)', fill: 'var(--color-gain)', fontSize: 10, position: 'right' }} />
          <ReferenceLine y={50} stroke="var(--color-border)" strokeDasharray="2 2" />
          <Area type="monotone" dataKey="rsi" stroke="#a855f7" fill="#a855f7" fillOpacity={0.1} strokeWidth={2} dot={false} name="RSI" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
