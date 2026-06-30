import { RefreshCw, Loader2, Brain, Sparkles, Activity, BarChart3 } from 'lucide-react';

const TIME_RANGES = ['1d', '3d', '1w', '1m', '3m', '6m', '1y', 'all'];
const VIEW_MODES = ['chart', 'prediction'];

export default function IndexChartControls({
  timeRange, setTimeRange,
  viewMode, setViewMode,
  scraping, handleScrape, scrapeMessage,
  generatingInsights, handleGenerateInsights,
  generatingPrediction, handleGeneratePrediction,
  autoRefreshEnabled, setAutoRefreshEnabled,
  lastRefreshTime, stats
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[20px] font-bold text-[var(--color-primary-text)]">NEPSE Index</h2>
          <div className="flex items-center gap-3">
            <p className="text-[var(--color-secondary-text)] text-sm">Market benchmark</p>
            {stats && (
              <div className="flex items-center gap-1 text-xs text-[var(--color-secondary-text)]">
                <span>{stats.total_records.toLocaleString()} records</span>
              </div>
            )}
            {lastRefreshTime && (
              <div className="flex items-center gap-1 text-xs text-[var(--color-secondary-text)]">
                <span>Last: {lastRefreshTime.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Time range selector */}
        <div className="relative flex items-center bg-[var(--color-border)]/60 p-0.5 rounded-md border border-[var(--color-border)]">
          <div
            className="absolute top-0.5 bottom-0.5 rounded bg-[var(--color-brand)] transition-transform duration-200 ease-out"
            style={{
              width: `${100 / TIME_RANGES.length}%`,
              transform: `translateX(${TIME_RANGES.indexOf(timeRange) * 100}%)`
            }}
          />
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`relative z-10 flex-1 px-2.5 py-1 text-[11px] font-semibold rounded border-0 cursor-pointer transition-colors ${
                timeRange === range
                  ? 'text-white'
                  : 'text-[var(--color-secondary-text)] hover:text-[var(--color-primary-text)]'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Chart / Prediction toggle */}
        <div className="relative flex items-center bg-[var(--color-border)]/60 p-0.5 rounded-md border border-[var(--color-border)]">
          <div
            className="absolute top-0.5 bottom-0.5 rounded bg-[var(--color-brand)] transition-transform duration-200 ease-out"
            style={{
              width: `${100 / VIEW_MODES.length}%`,
              transform: `translateX(${VIEW_MODES.indexOf(viewMode) * 100}%)`
            }}
          />
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded border-0 cursor-pointer transition-colors ${
                viewMode === mode
                  ? 'text-white'
                  : 'text-[var(--color-secondary-text)] hover:text-[var(--color-primary-text)]'
              }`}
            >
              {mode === 'chart' ? <BarChart3 className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
              {mode === 'chart' ? 'Chart' : 'Prediction'}
            </button>
          ))}
        </div>

        <button
          onClick={handleScrape}
          disabled={scraping}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded border border-[var(--color-border)] cursor-pointer transition-colors bg-[var(--color-card-bg)] text-[var(--color-primary-text)] hover:bg-[var(--color-border)] disabled:opacity-50"
        >
          {scraping ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {scraping ? 'Fetching…' : 'Reload'}
        </button>

        {scrapeMessage && (
          <span className="text-[11px] text-[var(--color-secondary-text)] whitespace-nowrap">
            {scrapeMessage}
          </span>
        )}

        {viewMode === 'chart' && (
          <button
            onClick={handleGenerateInsights}
            disabled={generatingInsights}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded border border-[var(--color-border)] cursor-pointer transition-colors bg-[var(--color-card-bg)] text-[var(--color-primary-text)] hover:bg-[var(--color-border)] disabled:opacity-50"
          >
            {generatingInsights ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
            {generatingInsights ? 'Generating...' : 'Insights'}
          </button>
        )}
        {viewMode === 'prediction' && (
          <button
            onClick={handleGeneratePrediction}
            disabled={generatingPrediction}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded border border-[var(--color-border)] cursor-pointer transition-colors bg-[var(--color-card-bg)] text-[var(--color-primary-text)] hover:bg-[var(--color-border)] disabled:opacity-50"
          >
            {generatingPrediction ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {generatingPrediction ? 'Generating...' : 'Generate'}
          </button>
        )}

        <button
          onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded border cursor-pointer transition-colors ${
            autoRefreshEnabled
              ? 'border-[var(--color-gain)]/40 text-[var(--color-gain)] bg-[var(--color-gain)]/10'
              : 'border-[var(--color-border)] text-[var(--color-secondary-text)] bg-[var(--color-card-bg)]'
          }`}
          title={autoRefreshEnabled ? 'Auto-refresh enabled (5 min)' : 'Auto-refresh disabled'}
        >
          <Activity className="h-3 w-3" />
          {autoRefreshEnabled ? 'Live' : 'Paused'}
        </button>
      </div>
    </div>
  );
}
