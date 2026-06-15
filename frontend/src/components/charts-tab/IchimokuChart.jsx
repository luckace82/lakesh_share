import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function IchimokuChart({ data }) {
  return (
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
  );
}
