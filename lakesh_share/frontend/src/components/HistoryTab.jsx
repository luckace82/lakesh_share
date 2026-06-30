import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PER_PAGE = 30;

export default function HistoryTab({ history }) {
  const [page, setPage] = useState(0);

  if (!history.length) {
    return (
      <div className="card border-dashed flex flex-col items-center justify-center p-12">
        <p className="text-[var(--color-secondary-text)]">No historical data. Scrape data first.</p>
      </div>
    );
  }

  // Reverse to show newest first
  const sorted = [...history].reverse();
  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const pageData = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <table className="table text-sm">
          <thead>
            <tr>
              <th>Date</th>
              <th className="text-right">Open</th>
              <th className="text-right">High</th>
              <th className="text-right">Low</th>
              <th className="text-right">Close</th>
              <th className="text-right">Change</th>
              <th className="text-right">Volume</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((d, i) => {
              const close = parseFloat(d.close);
              const open = parseFloat(d.open);
              const change = open !== 0 ? ((close - open) / open * 100) : 0;
              const isUp = close >= open;

              return (
                <tr key={d.date}>
                  <td className="font-mono">{d.date}</td>
                  <td className="text-right font-mono">{parseFloat(d.open).toLocaleString()}</td>
                  <td className="text-right font-mono">{parseFloat(d.high).toLocaleString()}</td>
                  <td className="text-right font-mono">{parseFloat(d.low).toLocaleString()}</td>
                  <td className={`text-right font-mono font-medium ${isUp ? 'text-gain' : 'text-loss'}`}>
                    {close.toLocaleString()}
                  </td>
                  <td className={`text-right font-mono text-xs ${isUp ? 'text-gain' : 'text-loss'}`}>
                    {isUp ? '+' : ''}{change.toFixed(2)}%
                  </td>
                  <td className="text-right font-mono text-[var(--color-secondary-text)]">{d.volume?.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-secondary-text)]">
            Showing {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-secondary flex items-center gap-1 text-sm disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="btn-secondary flex items-center gap-1 text-sm disabled:opacity-30"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
