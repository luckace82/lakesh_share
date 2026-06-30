import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function WilliamsRChart({ data }) {
  return (
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
  );
}
