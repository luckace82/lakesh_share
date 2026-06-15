export default function IndexInsightsSidebar({ insights }) {
  return (
    <div className="w-80">
      <h3 className="text-sm font-semibold text-[var(--color-primary-text)] mb-3">AI Insights (1 Month)</h3>
      {insights.length > 0 ? (
        <div className="space-y-2">
          {insights.map((insight) => (
            <div key={insight.id} className="p-3 bg-[var(--color-border)] rounded text-sm text-[var(--color-primary-text)]">
              {insight.insight}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[var(--color-secondary-text)] text-sm">
          No insights available yet. Click reload to fetch latest data.
        </div>
      )}
    </div>
  );
}
