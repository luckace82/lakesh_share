import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ComposedChart, Bar } from 'recharts';
import { RefreshCw, Loader2, TrendingUp, Database, Brain, Sparkles, Activity, Zap } from 'lucide-react';
import { getNEPSEIndexData, scrapeNEPSEIndex, getNEPSEInsights, getNEPSEIndexStats, generateNEPSEInsights, getNEPSEPredictions, generateNEPSEPrediction } from '../api/client';

const TIME_RANGES = ['1d', '3d', '1w', '1m', '3m', '6m', '1y', 'all'];
const VIEW_MODES = ['chart', 'prediction'];

export default function NEPSEIndexChart() {
  const [timeRange, setTimeRange] = useState('1w');
  const [viewMode, setViewMode] = useState('chart');
  const [data, setData] = useState([]);
  const [insights, setInsights] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [historicalData, setHistoricalData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [generatingPrediction, setGeneratingPrediction] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  const intervalRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getNEPSEIndexData(timeRange);
      // Sort by timestamp ascending (oldest first) for proper chart display
      const sortedData = [...res.data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      let formattedData = sortedData.map(item => ({
        time: new Date(item.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        date: new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: parseFloat(item.value),
        volume: item.volume,
        // Add moving averages for more complex visualization
        ma5: null,
        ma10: null,
        change: 0
      }));

      // Calculate moving averages
      for (let i = 0; i < formattedData.length; i++) {
        if (i >= 4) {
          const ma5 = formattedData.slice(i - 4, i + 1).reduce((sum, item) => sum + item.value, 0) / 5;
          formattedData[i].ma5 = ma5;
        }
        if (i >= 9) {
          const ma10 = formattedData.slice(i - 9, i + 1).reduce((sum, item) => sum + item.value, 0) / 10;
          formattedData[i].ma10 = ma10;
        }
        if (i > 0) {
          formattedData[i].change = ((formattedData[i].value - formattedData[i - 1].value) / formattedData[i - 1].value) * 100;
        }
      }

      // If no data for 1d range, fetch latest data
      if (formattedData.length === 0 && timeRange === '1d') {
        const latestRes = await getNEPSEIndexData('all');
        if (latestRes.data.length > 0) {
          // Sort to get the most recent item
          const sortedLatest = [...latestRes.data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          const latestItem = sortedLatest[sortedLatest.length - 1];
          formattedData = [{
            time: new Date(latestItem.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            date: new Date(latestItem.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: parseFloat(latestItem.value),
            volume: latestItem.volume,
            ma5: parseFloat(latestItem.value),
            ma10: parseFloat(latestItem.value),
            change: 0
          }];
        }
      }

      setData(formattedData);
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('Error fetching NEPSE index data:', error);
    }
    setLoading(false);
  };

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefreshEnabled) {
      // Refresh every 5 minutes during market hours
      const now = new Date();
      const marketHours = now.getHours() >= 10 && now.getHours() <= 15; // 10 AM to 3 PM
      
      if (marketHours) {
        intervalRef.current = setInterval(() => {
          fetchData();
          fetchStats();
        }, 5 * 60 * 1000); // 5 minutes
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefreshEnabled, timeRange]);

  const fetchInsights = async () => {
    try {
      const res = await getNEPSEInsights('1m');
      setInsights(res.data);
    } catch (error) {
      console.error('Error fetching NEPSE insights:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await getNEPSEIndexStats();
      setStats(res.data);
    } catch (error) {
      console.error('Error fetching NEPSE stats:', error);
    }
  };

  const fetchPredictions = async () => {
    try {
      const res = await getNEPSEPredictions();
      setPredictions(res.data);
    } catch (error) {
      console.error('Error fetching NEPSE predictions:', error);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const res = await getNEPSEIndexData('3m');
      const sortedData = [...res.data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const formattedData = sortedData.map(item => ({
        date: new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: item.value
      }));
      setHistoricalData(formattedData);
    } catch (error) {
      console.error('Error fetching historical data:', error);
    }
  };

  const handleGeneratePrediction = async () => {
    setGeneratingPrediction(true);
    try {
      await generateNEPSEPrediction();
      setTimeout(() => {
        fetchPredictions();
        setGeneratingPrediction(false);
      }, 5000);
    } catch (error) {
      console.error('Error generating prediction:', error);
      setGeneratingPrediction(false);
    }
  };

  const handleScrape = async () => {
    setScraping(true);
    setGeneratingInsights(true);
    try {
      await scrapeNEPSEIndex();
      await fetchData();
      await fetchStats();
      // Insights are auto-generated after scrape, wait for them
      setTimeout(() => {
        fetchInsights();
        setGeneratingInsights(false);
      }, 5000);
    } catch (error) {
      console.error('Error scraping NEPSE index:', error);
      setGeneratingInsights(false);
    }
    setScraping(false);
  };

  const handleGenerateInsights = async () => {
    setGeneratingInsights(true);
    try {
      await generateNEPSEInsights();
      // Wait a moment for the async task to complete
      setTimeout(() => {
        fetchInsights();
        setGeneratingInsights(false);
      }, 5000);
    } catch (error) {
      console.error('Error generating insights:', error);
      setGeneratingInsights(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchInsights();
    fetchStats();
    fetchPredictions();
  }, [timeRange]);

  useEffect(() => {
    if (viewMode === 'prediction') {
      fetchPredictions();
      fetchHistoricalData();
    }
  }, [viewMode]);

  const latestValue = data.length > 0 ? data[data.length - 1].value : 0;
  const previousValue = data.length > 1 ? data[data.length - 2].value : 0;
  const change = latestValue - previousValue;
  const changePercent = previousValue > 0 ? ((change / previousValue) * 100).toFixed(2) : 0;
  const isPositive = change >= 0;

  // Calculate dynamic Y-axis domain for prediction chart
  const allPredictionData = [
    ...historicalData.map(h => h.value),
    ...predictions.map(p => parseFloat(p.predicted_value)),
    ...predictions.map(p => parseFloat(p.upper_bound)),
    ...predictions.map(p => parseFloat(p.lower_bound))
  ].filter(v => v !== null && !isNaN(v));
  const minVal = allPredictionData.length > 0 ? Math.min(...allPredictionData) : 0;
  const maxVal = allPredictionData.length > 0 ? Math.max(...allPredictionData) : 100;
  const padding = (maxVal - minVal) * 0.1;
  const yDomain = [minVal - padding, maxVal + padding];

  // Calculate future dates for predictions
  const getFutureDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="card mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-[var(--color-brand)]" />
            <div>
              <h2 className="text-[20px] font-bold text-[var(--color-primary-text)]">NEPSE Index</h2>
              <div className="flex items-center gap-3">
                <p className="text-[var(--color-secondary-text)] text-sm">Market benchmark</p>
                {stats && (
                  <div className="flex items-center gap-1 text-xs text-[var(--color-secondary-text)]">
                    <Database className="h-3 w-3" />
                    <span>{stats.total_records.toLocaleString()} records</span>
                  </div>
                )}
                {lastRefreshTime && (
                  <div className="flex items-center gap-1 text-xs text-[var(--color-secondary-text)]">
                    <Zap className="h-3 w-3" />
                    <span>Last: {lastRefreshTime.toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {TIME_RANGES.map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-medium rounded border-0 cursor-pointer transition-colors ${
                  timeRange === range
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'bg-[var(--color-border)] text-[var(--color-secondary-text)] hover:bg-[var(--color-border)]'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-xs font-medium rounded border-0 cursor-pointer transition-colors ${
                  viewMode === mode
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    : 'bg-[var(--color-border)] text-[var(--color-secondary-text)] hover:bg-[var(--color-border)]'
                }`}
              >
                {mode === 'chart' ? 'Chart' : 'Prediction'}
              </button>
            ))}
          </div>
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {scraping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {scraping ? 'Scraping...' : 'Reload'}
          </button>
          {viewMode === 'chart' && (
            <button
              onClick={handleGenerateInsights}
              disabled={generatingInsights}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded border-0 cursor-pointer transition-colors bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
            >
              {generatingInsights ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
              {generatingInsights ? 'Generating...' : 'AI Insights'}
            </button>
          )}
          {viewMode === 'prediction' && (
            <button
              onClick={handleGeneratePrediction}
              disabled={generatingPrediction}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded border-0 cursor-pointer transition-colors bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
            >
              {generatingPrediction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generatingPrediction ? 'Generating...' : 'Generate'}
            </button>
          )}
          
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded border-0 cursor-pointer transition-colors ${
              autoRefreshEnabled 
                ? 'bg-green-500 text-white hover:bg-green-600' 
                : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
            title={autoRefreshEnabled ? 'Auto-refresh enabled (5 min)' : 'Auto-refresh disabled'}
          >
            <Activity className="h-3.5 w-3.5" />
            {autoRefreshEnabled ? 'Auto' : 'Manual'}
          </button>
        </div>
      </div>

      <div className="flex items-start gap-8">
        {/* Chart / Prediction */}
        <div className="flex-1">
          {viewMode === 'chart' ? (
            <>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-[32px] font-bold font-mono text-[var(--color-primary-text)]">
                  {latestValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`text-sm font-medium ${isPositive ? 'text-[var(--color-gain)]' : 'text-[var(--color-loss)]'}`}>
                  {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePercent}%)
                </span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-[var(--color-brand)] mx-auto mb-4" />
                    <p className="text-[var(--color-secondary-text)]">Loading NEPSE Index data...</p>
                  </div>
                </div>
              ) : data.length > 0 ? (
                <div className="space-y-4">
                  {/* Main price chart with moving averages */}
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                      <XAxis
                        dataKey={timeRange === '1d' || timeRange === '3d' ? 'time' : 'date'}
                        stroke="var(--color-secondary-text)"
                        fontSize={12}
                        tick={{ fill: 'var(--color-secondary-text)' }}
                      />
                      <YAxis
                        stroke="var(--color-secondary-text)"
                        fontSize={12}
                        domain={['dataMin - 100', 'dataMax + 100']}
                        tick={{ fill: 'var(--color-secondary-text)' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--color-card-bg)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '12px',
                          color: 'var(--color-primary-text)',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                        labelStyle={{ color: 'var(--color-secondary-text)', fontWeight: 'bold' }}
                        formatter={(value, name) => {
                          if (name === 'value') return [`NPR ${value.toLocaleString()}`, 'Index Value'];
                          if (name === 'ma5') return [`NPR ${value?.toFixed(2)}`, '5-day MA'];
                          if (name === 'ma10') return [`NPR ${value?.toFixed(2)}`, '10-day MA'];
                          return [value, name];
                        }}
                      />
                      
                      {/* Area under the main line */}
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={isPositive ? 'var(--color-gain)' : 'var(--color-loss)'}
                        fill={isPositive ? 'var(--color-gain)' : 'var(--color-loss)'}
                        fillOpacity={0.1}
                        strokeWidth={3}
                      />
                      
                      {/* Moving averages */}
                      <Line
                        type="monotone"
                        dataKey="ma5"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="5 5"
                        name="5-day MA"
                      />
                      <Line
                        type="monotone"
                        dataKey="ma10"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="3 3"
                        name="10-day MA"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>

                  {/* Volume chart */}
                  {data.some(item => item.volume) && (
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.2} />
                        <XAxis
                          dataKey={timeRange === '1d' || timeRange === '3d' ? 'time' : 'date'}
                          stroke="var(--color-secondary-text)"
                          fontSize={10}
                          tick={{ fill: 'var(--color-secondary-text)' }}
                        />
                        <YAxis
                          stroke="var(--color-secondary-text)"
                          fontSize={10}
                          tick={{ fill: 'var(--color-secondary-text)' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--color-card-bg)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '8px',
                            color: 'var(--color-primary-text)'
                          }}
                          formatter={(value) => [value?.toLocaleString(), 'Volume']}
                        />
                        <Bar
                          dataKey="volume"
                          fill="var(--color-brand)"
                          fillOpacity={0.6}
                          radius={[2, 2, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}

                  {/* Chart legend */}
                  <div className="flex items-center justify-center gap-6 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${isPositive ? 'bg-[var(--color-gain)]' : 'bg-[var(--color-loss)]'}`}></div>
                      <span className="text-[var(--color-secondary-text)]">Index Value</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-0.5 bg-blue-500"></div>
                      <span className="text-[var(--color-secondary-text)]">5-day MA</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-0.5 bg-purple-500"></div>
                      <span className="text-[var(--color-secondary-text)]">10-day MA</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 text-[var(--color-secondary-text)]">
                  <div className="text-center">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No data available for selected time range</p>
                    <button
                      onClick={handleScrape}
                      className="mt-4 px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand)]/90 transition-colors"
                    >
                      Fetch Latest Data
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-[var(--color-primary-text)] mb-4">7-Day Prediction (Based on 3 months data)</h3>
              {generatingPrediction ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand)] mx-auto mb-2" />
                    <p className="text-[var(--color-secondary-text)]">Generating predictions...</p>
                  </div>
                </div>
              ) : predictions.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={[
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
                    ]}>
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
              ) : (
                <div className="flex items-center justify-center h-64 text-[var(--color-secondary-text)]">
                  No predictions available. Click Generate to create predictions.
                </div>
              )}
            </>
          )}
        </div>

        {/* AI Insights - only show in chart mode */}
        {viewMode === 'chart' && (
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
        )}
      </div>
    </div>
  );
}
