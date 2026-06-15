import { useState, useEffect, useRef, useCallback } from 'react';
import { getNEPSEIndexData, scrapeNEPSEIndex, getScrapeTaskStatus, getNEPSEInsights, getNEPSEIndexStats, generateNEPSEInsights, getNEPSEPredictions, generateNEPSEPrediction } from '../api/client';
import IndexChartControls from './nepse-chart/IndexChartControls';
import IndexPriceChart from './nepse-chart/IndexPriceChart';
import IndexVolumeChart from './nepse-chart/IndexVolumeChart';
import IndexPeriodStats from './nepse-chart/IndexPeriodStats';
import IndexPredictionChart from './nepse-chart/IndexPredictionChart';
import IndexInsightsSidebar from './nepse-chart/IndexInsightsSidebar';

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
  const [scrapeMessage, setScrapeMessage] = useState('');
  const intervalRef = useRef(null);
  const scrapePollRef = useRef(null);

  const getLabel = useCallback((item) => {
    const d = new Date(item.timestamp);
    const hour = d.getHours();
    const isMidnight = hour === 0 && d.getMinutes() === 0;
    if (timeRange === '1d') {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    if (timeRange === '3d') {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + (isMidnight ? '' : ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    }
    if (timeRange === '1w') {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: timeRange === 'all' ? 'numeric' : undefined });
  }, [timeRange]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNEPSEIndexData(timeRange);
      const sortedData = [...res.data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      let formattedData = sortedData.map(item => ({
        rawTimestamp: item.timestamp,
        label: getLabel(item),
        value: parseFloat(item.value),
        volume: item.volume,
        ma5: null,
        ma10: null,
        change: 0
      }));

      for (let i = 0; i < formattedData.length; i++) {
        if (i >= 4) {
          formattedData[i].ma5 = formattedData.slice(i - 4, i + 1).reduce((sum, item) => sum + item.value, 0) / 5;
        }
        if (i >= 9) {
          formattedData[i].ma10 = formattedData.slice(i - 9, i + 1).reduce((sum, item) => sum + item.value, 0) / 10;
        }
        if (i > 0) {
          formattedData[i].change = ((formattedData[i].value - formattedData[i - 1].value) / formattedData[i - 1].value) * 100;
        }
      }

      if (formattedData.length === 0 && (timeRange === '1d' || timeRange === '3d')) {
        const latestRes = await getNEPSEIndexData('all');
        if (latestRes.data.length > 0) {
          const sortedLatest = [...latestRes.data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          const latestItem = sortedLatest[sortedLatest.length - 1];
          formattedData = [{
            rawTimestamp: latestItem.timestamp,
            label: getLabel(latestItem),
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
  }, [timeRange, getLabel]);

  useEffect(() => {
    if (autoRefreshEnabled) {
      const now = new Date();
      const marketHours = now.getHours() >= 10 && now.getHours() <= 15;
      if (marketHours) {
        intervalRef.current = setInterval(() => {
          fetchData();
          fetchStats();
        }, 5 * 60 * 1000);
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefreshEnabled, timeRange, fetchData]);

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
    setScrapeMessage('Starting NEPSE data fetch…');
    if (scrapePollRef.current) clearInterval(scrapePollRef.current);
    try {
      const res = await scrapeNEPSEIndex();
      const taskId = res.data?.task_id;

      if (!taskId) {
        await fetchData();
        await fetchStats();
        setScraping(false);
        setScrapeMessage('');
        return;
      }

      setScrapeMessage('Fetching latest NEPSE data…');
      let attempts = 0;
      const MAX_ATTEMPTS = 40;
      scrapePollRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const statusRes = await getScrapeTaskStatus(taskId);
          const { state, ready, result } = statusRes.data;

          if (ready) {
            clearInterval(scrapePollRef.current);
            scrapePollRef.current = null;

            if (state === 'SUCCESS') {
              const added = result?.upserted ?? 0;
              setScrapeMessage(added > 0 ? `Updated — ${added} new record(s)` : 'Already up to date');
              await fetchData();
              await fetchStats();
              setGeneratingInsights(true);
              setTimeout(() => {
                fetchInsights();
                setGeneratingInsights(false);
              }, 5000);
            } else {
              setScrapeMessage('Fetch failed. Please try again.');
            }
            setScraping(false);
            setTimeout(() => setScrapeMessage(''), 4000);
          } else if (attempts >= MAX_ATTEMPTS) {
            clearInterval(scrapePollRef.current);
            scrapePollRef.current = null;
            setScraping(false);
            setScrapeMessage('Still running in background — refresh shortly.');
            setTimeout(() => setScrapeMessage(''), 5000);
          }
        } catch (err) {
          clearInterval(scrapePollRef.current);
          scrapePollRef.current = null;
          setScraping(false);
          setScrapeMessage('');
        }
      }, 3000);
    } catch (error) {
      console.error('Error scraping NEPSE index:', error);
      setScraping(false);
      setScrapeMessage('Could not start fetch.');
      setTimeout(() => setScrapeMessage(''), 4000);
    }
  };

  const handleGenerateInsights = async () => {
    setGeneratingInsights(true);
    try {
      await generateNEPSEInsights();
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
  }, [timeRange, fetchData]);

  useEffect(() => {
    if (viewMode === 'prediction') {
      fetchPredictions();
      fetchHistoricalData();
    }
  }, [viewMode]);

  const latestValue = data.length > 0 ? data[data.length - 1].value : 0;
  const startValue = data.length > 0 ? data[0].value : 0;
  const change = latestValue - startValue;
  const changePercent = startValue > 0 ? ((change / startValue) * 100).toFixed(2) : 0;
  const isPositive = change >= 0;

  const chartMin = data.length > 0 ? Math.min(...data.map(d => d.value)) : 0;
  const chartMax = data.length > 0 ? Math.max(...data.map(d => d.value)) : 100;
  const chartPad = data.length > 0 ? (chartMax - chartMin) * 0.08 || chartMin * 0.02 : 5;
  const yDomainMain = [Math.floor(chartMin - chartPad), Math.ceil(chartMax + chartPad)];

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

  const getFutureDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="card mb-8">
      <IndexChartControls
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        viewMode={viewMode}
        setViewMode={setViewMode}
        scraping={scraping}
        handleScrape={handleScrape}
        scrapeMessage={scrapeMessage}
        generatingInsights={generatingInsights}
        handleGenerateInsights={handleGenerateInsights}
        generatingPrediction={generatingPrediction}
        handleGeneratePrediction={handleGeneratePrediction}
        autoRefreshEnabled={autoRefreshEnabled}
        setAutoRefreshEnabled={setAutoRefreshEnabled}
        lastRefreshTime={lastRefreshTime}
        stats={stats}
      />

      <IndexPeriodStats data={data} />

      <div className="flex items-start gap-8">
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
              <IndexPriceChart data={data} loading={loading} isPositive={isPositive} yDomainMain={yDomainMain} />
              <IndexVolumeChart data={data} />
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-[var(--color-primary-text)] mb-4">7-Day Prediction (Based on 3 months data)</h3>
              <IndexPredictionChart
                generatingPrediction={generatingPrediction}
                historicalData={historicalData}
                predictions={predictions}
                yDomain={yDomain}
                getFutureDate={getFutureDate}
              />
            </>
          )}
        </div>

        {viewMode === 'chart' && <IndexInsightsSidebar insights={insights} />}
      </div>
    </div>
  );
}
