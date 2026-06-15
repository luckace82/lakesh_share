function StatCell({ label, value, valueClass }) {
  return (
    <div className="flex-1 px-4 py-2.5 border-r border-[var(--color-border)] last:border-r-0 bg-[var(--color-card-bg)]">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-secondary-text)] mb-0.5">{label}</p>
      <p className={`text-sm font-semibold numeric ${valueClass || 'text-[var(--color-primary-text)]'}`}>{value}</p>
    </div>
  );
}

export default function IndexPeriodStats({ data }) {
  if (data.length === 0) return null;

  const periodHigh = Math.max(...data.map(d => d.value));
  const periodLow = Math.min(...data.map(d => d.value));
  const periodAvg = (data.reduce((sum, d) => sum + d.value, 0) / data.length).toFixed(2);
  const periodChange = ((data[data.length - 1].value - data[0].value) / data[0].value * 100).toFixed(2);
  const periodPositive = parseFloat(periodChange) >= 0;

  return (
    <div className="flex items-stretch gap-0 mb-5 rounded-md border border-[var(--color-border)] overflow-hidden">
      <StatCell label="High" value={periodHigh.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
      <StatCell label="Low" value={periodLow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
      <StatCell label="Avg" value={periodAvg} />
      <StatCell
        label="Period Change"
        value={`${periodPositive ? '+' : ''}${periodChange}%`}
        valueClass={periodPositive ? 'text-[var(--color-gain)]' : 'text-[var(--color-loss)]'}
      />
      <StatCell label="Data Points" value={data.length} />
    </div>
  );
}
