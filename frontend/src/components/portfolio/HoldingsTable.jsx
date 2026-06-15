import { Link } from 'react-router-dom';
import { Briefcase, Trash2, Eye } from 'lucide-react';

export default function HoldingsTable({ portfolio, showStockChart, handleRemove }) {
  if (portfolio.length === 0) {
    return (
      <div className="card border-dashed flex flex-col items-center justify-center p-12">
        <Briefcase className="h-12 w-12 text-[var(--color-secondary-text)] mx-auto mb-3" />
        <p className="text-[var(--color-secondary-text)] text-lg">No holdings yet</p>
        <p className="text-[var(--color-secondary-text)] text-sm mt-1">Add your stock purchases to track P/L</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="table">
        <thead>
          <tr>
            <th>Stock</th>
            <th className="text-right">Total Qty</th>
            <th className="text-right">Avg Price</th>
            <th className="text-right">Current</th>
            <th className="text-right">P/L</th>
            <th className="text-right">P/L %</th>
            <th className="text-center">Transactions</th>
            <th className="text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {portfolio.map((h) => {
            const pl = h.profit_loss;
            const isUp = pl !== null && pl >= 0;
            return (
              <tr key={`${h.stock.symbol}-aggregated`}>
                <td>
                  <Link to={`/stocks/${h.stock.symbol}`} className="no-underline">
                    <div className="font-mono font-bold text-[var(--color-primary-text)]">{h.stock.symbol}</div>
                    <div className="text-xs text-[var(--color-secondary-text)]">{h.stock.name}</div>
                  </Link>
                </td>
                <td className="text-right font-mono text-[var(--color-primary-text)]">{h.quantity}</td>
                <td className="text-right font-mono text-[var(--color-primary-text)]">NPR {parseFloat(h.buy_price).toLocaleString()}</td>
                <td className="text-right font-mono text-[var(--color-primary-text)]">NPR {(h.current_price || parseFloat(h.buy_price)).toLocaleString()}</td>
                <td className={`text-right font-mono ${isUp ? 'text-gain' : 'text-loss'}`}>{pl !== null ? (isUp ? '+' : '') + pl.toFixed(2) : '-'}</td>
                <td className={`text-right font-mono ${isUp ? 'text-gain' : 'text-loss'}`}>{h.profit_loss_pct !== null ? (isUp ? '+' : '') + h.profit_loss_pct.toFixed(2) + '%' : '-'}</td>
                <td className="text-center">
                  <button onClick={() => showStockChart(h.stock.symbol)} className="text-[var(--color-brand)] hover:underline bg-transparent border-0 p-0" title="View transactions">
                    <Eye className="h-4 w-4 inline" />
                  </button>
                </td>
                <td className="text-center">
                  <button onClick={() => handleRemove(h.id)} className="text-[var(--color-loss)] hover:underline bg-transparent border-0 p-0" title="Remove">
                    <Trash2 className="h-4 w-4 inline" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
