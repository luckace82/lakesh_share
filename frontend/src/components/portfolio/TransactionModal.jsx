import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { X } from 'lucide-react';

export default function TransactionModal({ show, onClose, selectedStock, stockHistory, transactions }) {
  if (!show || !selectedStock) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-page-bg)] border border-[var(--color-border)] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--color-page-bg)] border-b border-[var(--color-border)] p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--color-primary-text)]">{selectedStock} - Chart & Transactions</h3>
          <button onClick={onClose} className="text-[var(--color-secondary-text)] hover:text-[var(--color-primary-text)] bg-transparent border-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-6">
            <h4 className="text-sm font-medium text-[var(--color-secondary-text)] mb-3">Price History (Last 60 Days)</h4>
            {stockHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stockHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" stroke="var(--color-secondary-text)" fontSize={12} />
                  <YAxis stroke="var(--color-secondary-text)" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-border)' }}
                    labelStyle={{ color: 'var(--color-primary-text)' }}
                  />
                  <Line type="monotone" dataKey="price" stroke="var(--color-gain)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-[var(--color-secondary-text)]">
                No chart data available
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium text-[var(--color-secondary-text)] mb-3">Transaction History</h4>
            {transactions.length > 0 ? (
              <div className="overflow-hidden">
                <table className="table text-sm">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="text-right">Quantity</th>
                      <th className="text-right">Buy Price</th>
                      <th className="text-right">Total Cost</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t, idx) => (
                      <tr key={idx}>
                        <td className="font-mono">{t.buy_date}</td>
                        <td className="text-right font-mono">{t.quantity}</td>
                        <td className="text-right font-mono">NPR {parseFloat(t.buy_price).toLocaleString()}</td>
                        <td className="text-right font-mono">NPR {(parseFloat(t.buy_price) * t.quantity).toLocaleString()}</td>
                        <td className="text-[var(--color-secondary-text)] text-xs">{t.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--color-secondary-text)]">
                No transactions found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
