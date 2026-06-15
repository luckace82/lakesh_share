export function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse bg-[var(--color-border)] rounded ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function ChartSkeleton({ height = 300 }) {
  return (
    <div className="card">
      <Skeleton className="h-4 w-40 mb-4" />
      <div style={{ height }} className="flex items-end gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${20 + Math.random() * 60}%` }} />
        ))}
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 6 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}
