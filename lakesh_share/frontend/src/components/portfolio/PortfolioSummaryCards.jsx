import { DollarSign, PieChart as PieChartIcon, TrendingUp, TrendingDown } from 'lucide-react';

function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-secondary-text)]">{label}</p>
          <p className={`text-[16px] font-mono font-bold mt-1 ${color || 'text-[var(--color-primary-text)]'}`}>{value}</p>
        </div>
        <Icon className={`h-6 w-6 ${color || 'text-[var(--color-secondary-text)]'}`} />
      </div>
    </div>
  );
}

export default function PortfolioSummaryCards({ totalInvested, totalCurrent, totalPL, totalPLPct }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <SummaryCard label="Total Invested" value={`NPR ${totalInvested.toLocaleString(undefined, {maximumFractionDigits: 0})}`} icon={DollarSign} />
      <SummaryCard label="Current Value" value={`NPR ${totalCurrent.toLocaleString(undefined, {maximumFractionDigits: 0})}`} icon={PieChartIcon} />
      <SummaryCard
        label="Total P/L"
        value={`${totalPL >= 0 ? '+' : ''}NPR ${totalPL.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
        color={totalPL >= 0 ? 'text-gain' : 'text-loss'}
        icon={totalPL >= 0 ? TrendingUp : TrendingDown}
      />
      <SummaryCard
        label="Return %"
        value={`${totalPLPct >= 0 ? '+' : ''}${totalPLPct.toFixed(2)}%`}
        color={totalPLPct >= 0 ? 'text-gain' : 'text-loss'}
        icon={totalPLPct >= 0 ? TrendingUp : TrendingDown}
      />
    </div>
  );
}
