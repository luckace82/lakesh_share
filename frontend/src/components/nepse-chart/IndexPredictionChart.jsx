import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2 } from 'lucide-react';

export default function IndexPredictionChart({
  generatingPrediction,
  historicalData,
  predictions,
  yDomain,
  getFutureDate
}) {
  if (generatingPrediction) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand)] mx-auto mb-2" />
          <p className="text-[var(--color-secondary-text)]">Generating predictions...</p>
        </div>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--color-secondary-text)]">
        No predictions available. Click Generate to create predictions.
      </div>
    );
  }

  const chartData = [
    ...historicalData.map(h => ({
      label: h.date,
      historical: h.value,
      predicted: null,
      upper: null,
      lower: null
    })),
    ...predictions.map(p => ({
      label: getFutureDate(p.day),
      historical: null,
      predicted: parseFloat(p.predicted_value),
      upper: parseFloat(p.upper_bound),
      lower: parseFloat(p.lower_bound)
    }))
  ];

  return (
    <>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" stroke="var(--color-secondary-text)" fontSize={12} />
          <YAxis stroke="var(--color-secondary-text)" fontSize={12} domain={yDomain} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-card-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-primary-text)'
            }}
            labelStyle={{ color: 'var(--color-secondary-text)' }}
          />
          <Line type="monotone" dataKey="historical" stroke="var(--color-secondary-text)" strokeWidth={2} dot={false} name="Historical" connectNulls={false} />
          <Line type="monotone" dataKey="upper" stroke="var(--color-gain)" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Upper Bound" connectNulls={false} />
          <Line type="monotone" dataKey="lower" stroke="var(--color-loss)" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Lower Bound" connectNulls={false} />
          <Line type="monotone" dataKey="predicted" stroke="var(--color-brand)" strokeWidth={2} dot={true} name="Predicted" connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4 space-y-2">
        {predictions.map((pred) => (
          <div key={pred.id} className="p-3 bg-[var(--color-border)] rounded flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[var(--color-primary-text)]">{getFutureDate(pred.day)}</span>
              <span className="text-lg font-bold font-mono text-[var(--color-brand)]">
                {parseFloat(pred.predicted_value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-[var(--color-gain)]">Upper: {parseFloat(pred.upper_bound).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span className="text-[var(--color-loss)]">Lower: {parseFloat(pred.lower_bound).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
