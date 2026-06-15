import { Search, X } from 'lucide-react';

export default function AddHoldingForm({
  form, setForm,
  search, setSearch,
  suggestions, selectStock,
  handleAdd
}) {
  return (
    <div className="card mb-8">
      <h3 className="font-semibold mb-4 text-[var(--color-primary-text)]">Add New Holding</h3>
      <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div className="relative">
          <label className="block text-xs text-[var(--color-secondary-text)] mb-1">Stock</label>
          {form.stock_symbol ? (
            <div className="flex items-center gap-2 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2.5">
              <span className="text-[var(--color-primary-text)] font-medium font-mono">{form.stock_symbol}</span>
              <button type="button" onClick={() => setForm({...form, stock_symbol: ''})} className="text-[var(--color-secondary-text)] hover:text-[var(--color-loss)] bg-transparent border-0 p-0"><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                className="input text-sm" />
              {suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map(s => (
                    <button key={s.symbol} type="button" onClick={() => selectStock(s.symbol)}
                      className="block w-full text-left px-3 py-2 hover:bg-[var(--color-border)] text-sm text-[var(--color-primary-text)] border-0 bg-transparent">
                      <span className="font-mono font-medium">{s.symbol}</span> <span className="text-[var(--color-secondary-text)]">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div>
          <label className="block text-xs text-[var(--color-secondary-text)] mb-1">Quantity</label>
          <input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} placeholder="Qty"
            className="input text-sm" />
        </div>
        <div>
          <label className="block text-xs text-[var(--color-secondary-text)] mb-1">Buy Price</label>
          <input type="number" step="0.01" value={form.buy_price} onChange={e => setForm({...form, buy_price: e.target.value})} placeholder="Price"
            className="input text-sm" />
        </div>
        <div>
          <label className="block text-xs text-[var(--color-secondary-text)] mb-1">Buy Date</label>
          <input type="date" value={form.buy_date} onChange={e => setForm({...form, buy_date: e.target.value})}
            className="input text-sm" />
        </div>
        <div>
          <button type="submit" className="btn-primary w-full">
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
