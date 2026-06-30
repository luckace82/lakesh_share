import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function VolumeBar(props) {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const color = payload.isUp ? 'var(--color-gain)' : 'var(--color-loss)';
  return <rect x={x} y={y} width={width} height={Math.abs(height)} fill={color} opacity={0.6} rx={1} />;
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

export default function VolumeChart({ data }) {
  return (
    <div className="card">
      <h3 className="text-sm font-medium text-[var(--color-secondary-text)] mb-4">Volume</h3>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" tick={{ fill: 'var(--color-secondary-text)', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fill: 'var(--color-secondary-text)', fontSize: 11 }} tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v} />
          <Tooltip content={<VolumeTooltip />} />
          <Bar dataKey="volume" name="Volume" shape={<VolumeBar />} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
