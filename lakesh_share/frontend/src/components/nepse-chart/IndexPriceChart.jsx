import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function IndexPriceChart({ data, loading, isPositive, yDomainMain }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner h-12 w-12 mx-auto mb-4" />
          <p className="text-[var(--color-secondary-text)]">Loading NEPSE Index data...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-[var(--color-secondary-text)]">
        <p>No data available for selected time range</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={data}>
          <defs>
            <linearGradient id="indexGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? 'var(--color-gain)' : 'var(--color-loss)'} stopOpacity={0.25} />
              <stop offset="100%" stopColor={isPositive ? 'var(--color-gain)' : 'var(--color-loss)'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
          <XAxis
            dataKey="label"
            stroke="var(--color-secondary-text)"
            fontSize={12}
            tick={{ fill: 'var(--color-secondary-text)' }}
            interval="preserveStartEnd"
            minTickGap={30}
          />
          <YAxis
            stroke="var(--color-secondary-text)"
            fontSize={12}
            domain={yDomainMain}
            tick={{ fill: 'var(--color-secondary-text)' }}
            tickFormatter={(v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          />
          <Tooltip
            cursor={{ stroke: 'var(--color-secondary-text)', strokeWidth: 1, strokeDasharray: '3 3' }}
            contentStyle={{
              backgroundColor: 'var(--color-card-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              color: 'var(--color-primary-text)',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
            labelStyle={{ color: 'var(--color-secondary-text)', fontWeight: 'bold' }}
            labelFormatter={(label, payload) => {
              if (payload && payload.length > 0 && payload[0].payload?.rawTimestamp) {
                const d = new Date(payload[0].payload.rawTimestamp);
                return d.toLocaleString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                });
              }
              return label;
            }}
            formatter={(value, name) => {
              if (name === 'value') return [`NPR ${value.toLocaleString()}`, 'Index Value'];
              if (name === 'ma5') return [`NPR ${value?.toFixed(2)}`, '5-day MA'];
              if (name === 'ma10') return [`NPR ${value?.toFixed(2)}`, '10-day MA'];
              return [value, name];
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={isPositive ? 'var(--color-gain)' : 'var(--color-loss)'}
            fill="url(#indexGradient)"
            strokeWidth={3}
          />
          <Line
            type="monotone"
            dataKey="ma5"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 5"
            name="5-day MA"
          />
          <Line
            type="monotone"
            dataKey="ma10"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={false}
            strokeDasharray="3 3"
            name="10-day MA"
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isPositive ? 'bg-[var(--color-gain)]' : 'bg-[var(--color-loss)]'}`}></div>
          <span className="text-[var(--color-secondary-text)]">Index Value</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-blue-500"></div>
          <span className="text-[var(--color-secondary-text)]">5-day MA</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-purple-500"></div>
          <span className="text-[var(--color-secondary-text)]">10-day MA</span>
        </div>
      </div>
    </div>
  );
}
