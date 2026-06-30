import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

export default function PriceMAChart({ data }) {
  return (
    <div className="card">
      <h3 className="text-sm font-medium text-[var(--color-secondary-text)] mb-4">Price, Moving Averages & Bollinger Bands</h3>
      <ResponsiveContainer width="100%" height={500}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" tick={{ fill: 'var(--color-secondary-text)', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--color-secondary-text)', fontSize: 11 }} />
          <Tooltip content={<PriceTooltip />} />
          <Legend />
          <Area type="monotone" dataKey="bbUpper" stroke="transparent" fill="#3b82f6" fillOpacity={0.05} name="BB Upper" />
          <Area type="monotone" dataKey="bbLower" stroke="transparent" fill="transparent" name="BB Lower" />
          <Line type="monotone" dataKey="bbUpper" stroke="#3b82f680" strokeWidth={1} dot={false} name="" strokeDasharray="2 2" legendType="none" />
          <Line type="monotone" dataKey="bbLower" stroke="#3b82f680" strokeWidth={1} dot={false} name="" strokeDasharray="2 2" legendType="none" />
          <Line type="monotone" dataKey="close" stroke="var(--color-gain)" strokeWidth={2} dot={false} name="Close" />
          <Line type="monotone" dataKey="ma20" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="MA20" strokeDasharray="4 2" />
          <Line type="monotone" dataKey="ma50" stroke="#6366f1" strokeWidth={1.5} dot={false} name="MA50" strokeDasharray="4 2" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
