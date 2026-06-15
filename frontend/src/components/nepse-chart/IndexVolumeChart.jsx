import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function IndexVolumeChart({ data }) {
  if (!data.some(item => item.volume)) return null;

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.2} />
        <XAxis
          dataKey="label"
          stroke="var(--color-secondary-text)"
          fontSize={10}
          tick={{ fill: 'var(--color-secondary-text)' }}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          stroke="var(--color-secondary-text)"
          fontSize={10}
          tick={{ fill: 'var(--color-secondary-text)' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-card-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            color: 'var(--color-primary-text)'
          }}
          formatter={(value) => [value?.toLocaleString(), 'Volume']}
        />
        <Bar
          dataKey="volume"
          fill="var(--color-brand)"
          fillOpacity={0.6}
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
