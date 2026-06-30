import { ComposedChart, LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';

const COLORS = ['var(--color-brand)', 'var(--color-info)', 'var(--color-warning)', 'var(--color-gain)', 'var(--color-loss)', '#6366f1', '#ec4899', '#14b8a6'];

export default function PortfolioCharts({ portfolioValueHistory, assetAllocation, stockContribution, plHistory, totalPL }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Portfolio Value Line Chart */}
      <div className="card">
        <h3 className="text-sm font-semibold text-[var(--color-primary-text)] mb-4">Portfolio Value (Last 30 Days)</h3>
        {portfolioValueHistory.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={portfolioValueHistory}>
              <defs>
                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={portfolioValueHistory[portfolioValueHistory.length - 1].value >= portfolioValueHistory[0].value ? 'var(--color-gain)' : 'var(--color-loss)'} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={portfolioValueHistory[portfolioValueHistory.length - 1].value >= portfolioValueHistory[0].value ? 'var(--color-gain)' : 'var(--color-loss)'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" stroke="var(--color-secondary-text)" fontSize={12} />
              <YAxis stroke="var(--color-secondary-text)" fontSize={12} tickFormatter={(value) => `NPR ${(value / 1000).toFixed(0)}k`} />
              <Tooltip
                cursor={{ stroke: 'var(--color-secondary-text)', strokeWidth: 1, strokeDasharray: '3 3' }}
                contentStyle={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-border)' }}
                labelStyle={{ color: 'var(--color-primary-text)' }}
                formatter={(value) => `NPR ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />
              <Area type="monotone" dataKey="value" stroke="transparent" fill="url(#portfolioGradient)" />
              <Line
                type="monotone"
                dataKey="value"
                stroke={portfolioValueHistory[portfolioValueHistory.length - 1].value >= portfolioValueHistory[0].value ? 'var(--color-gain)' : 'var(--color-loss)'}
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-[var(--color-secondary-text)]">
            No portfolio value data available
          </div>
        )}
      </div>

      {/* Asset Allocation Pie Chart */}
      <div className="card">
        <h3 className="text-sm font-semibold text-[var(--color-primary-text)] mb-4">Asset Allocation</h3>
        {assetAllocation.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={assetAllocation}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {assetAllocation.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-border)' }}
                labelStyle={{ color: 'var(--color-primary-text)' }}
                formatter={(value) => `NPR ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-[var(--color-secondary-text)]">
            No allocation data available
          </div>
        )}
      </div>

      {/* Stock Contribution Bar Chart */}
      <div className="card">
        <h3 className="text-sm font-semibold text-[var(--color-primary-text)] mb-4">Stock Contribution to P/L</h3>
        {stockContribution.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stockContribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-secondary-text)" fontSize={12} />
              <YAxis stroke="var(--color-secondary-text)" fontSize={12} tickFormatter={(value) => `NPR ${(value / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-border)' }}
                labelStyle={{ color: 'var(--color-primary-text)' }}
                formatter={(value) => `NPR ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />
              <Bar dataKey="pl" name="P/L">
                {stockContribution.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={entry.pl >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-[var(--color-secondary-text)]">
            No contribution data available
          </div>
        )}
      </div>

      {/* P&L Line Chart */}
      <div className="card">
        <h3 className="text-sm font-semibold text-[var(--color-primary-text)] mb-4">P&L History (Last 30 Days)</h3>
        {plHistory.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={plHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" stroke="var(--color-secondary-text)" fontSize={12} />
              <YAxis stroke="var(--color-secondary-text)" fontSize={12} tickFormatter={(value) => `NPR ${(value / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-border)' }}
                labelStyle={{ color: 'var(--color-primary-text)' }}
                formatter={(value) => `NPR ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />
              <Line
                type="monotone"
                dataKey="pl"
                stroke={totalPL >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-[var(--color-secondary-text)]">
            No P&L data available
          </div>
        )}
      </div>
    </div>
  );
}
