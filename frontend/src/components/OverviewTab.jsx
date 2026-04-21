import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { triggerScrape, getScrapeStatus, addToWatchlist, removeFromWatchlist, getWatchlist, downloadCSV } from '../api/client';
import { Download, Loader2, CheckCircle, XCircle, Star, Calendar, TrendingUp, TrendingDown, BarChart3, FileDown, StarOff } from 'lucide-react';

export default function OverviewTab({ stock, history, onRefresh }) {
  const { user } = useAuth();
  const [scrapeStatus, setScrapeStatus] = useState(null);
  const [scraping, setScraping] = useState(false);
  const [watched, setWatched] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    getWatchlist().then(res => {
      const list = res.data.results || res.data;
      setWatched(list.some(w => w.stock?.symbol === stock?.symbol));
    }).catch(() => {});
  }, [user, stock?.symbol]);

  const handleWatch = async () => {
    if (!user) return alert('Please login');
    try {
      if (watched) {
        await removeFromWatchlist(stock.symbol);
        setWatched(false);
      } else {
        await addToWatchlist(stock.symbol);
        setWatched(true);
      }
    } catch {}
  };

  const handleScrape = async () => {
    if (!user) return alert('Please login to scrape data');
    setScraping(true);
    // Estimate time: ~30 seconds per 60 pages for full scrape, ~10 seconds for incremental
    const hasData = stock?.daily_count > 0;
    setEstimatedTime(hasData ? '10-20 seconds' : '2-3 minutes');
    try {
      const res = await triggerScrape(stock.symbol);
      setScrapeStatus(res.data);
      startPolling();
    } catch (err) {
      setScraping(false);
      setEstimatedTime(null);
      alert(err.response?.data?.error || 'Scrape failed');
    }
  };

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await getScrapeStatus(stock.symbol);
        setScrapeStatus(res.data);
        if (res.data.status === 'completed' || res.data.status === 'failed') {
          clearInterval(pollRef.current);
          setScraping(false);
          setEstimatedTime(null);
          if (res.data.status === 'completed') onRefresh();
        }
      } catch {
        clearInterval(pollRef.current);
        setScraping(false);
        setEstimatedTime(null);
      }
    }, 3000);
  };

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const stats = computeStats(history);

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-primary-text)]">Data Status</h3>
            <p className="text-[var(--color-secondary-text)] text-sm mt-1">
              {stock?.daily_count > 0
                ? `${stock.daily_count} days of historical data`
                : 'No historical data yet — scrape to get started'}
            </p>
            {stock?.last_scraped && (
              <p className="text-[var(--color-secondary-text)] text-xs mt-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Last scraped: {new Date(stock.last_scraped).toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {history.length > 0 && (
              <button onClick={() => downloadCSV(stock.symbol, history)}
                className="btn-secondary flex items-center gap-2 text-sm">
                <FileDown className="h-4 w-4" />
                CSV
              </button>
            )}
            {user && (
              <button onClick={handleWatch}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                  watched ? 'bg-[var(--color-warning-tint)] border-[var(--color-warning)] text-[var(--color-warning)]' : 'btn-secondary hover:text-[var(--color-warning)]'
                }`}>
                {watched ? <Star className="h-4 w-4 fill-current" /> : <Star className="h-4 w-4" />}
                {watched ? 'Watching' : 'Watch'}
              </button>
            )}
            <button onClick={handleScrape} disabled={scraping || !user}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
              {scraping ? <><Loader2 className="h-4 w-4 animate-spin" /> Scraping...</> : <><Download className="h-4 w-4" /> Scrape Data</>}
            </button>
          </div>
        </div>

        {scrapeStatus && (
          <div className={`mt-4 p-3 rounded-lg border text-sm ${
            scrapeStatus.status === 'completed' ? 'bg-[var(--color-gain-tint)] border-[var(--color-gain)] text-[var(--color-gain)]' :
            scrapeStatus.status === 'failed' ? 'bg-[var(--color-loss-tint)] border-[var(--color-loss)] text-[var(--color-loss)]' :
            'bg-[var(--color-info-tint)] border-[var(--color-info)] text-[var(--color-info)]'
          }`}>
            <div className="flex items-center gap-2">
              {scrapeStatus.status === 'completed' && <CheckCircle className="h-4 w-4" />}
              {scrapeStatus.status === 'failed' && <XCircle className="h-4 w-4" />}
              {(scrapeStatus.status === 'running' || scrapeStatus.status === 'pending') && <Loader2 className="h-4 w-4 animate-spin" />}
              <span className="capitalize font-medium">{scrapeStatus.status}</span>
              {scrapeStatus.records_saved > 0 && <span>— {scrapeStatus.records_saved} records saved</span>}
            </div>
            {estimatedTime && (scrapeStatus.status === 'running' || scrapeStatus.status === 'pending') && (
              <p className="mt-1 text-xs">Estimated time: {estimatedTime}</p>
            )}
            {scrapeStatus.error && <p className="mt-1 text-xs">{scrapeStatus.error}</p>}
          </div>
        )}

        {!user && <p className="text-[var(--color-secondary-text)] text-sm mt-3">Login to scrape data and use AI analysis</p>}
      </div>

      {/* Stats Grid */}
      {history.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Latest Close" value={`NPR ${stats.latest?.toLocaleString()}`} icon={TrendingUp} />
          <StatCard
            label="Day Change"
            value={`${stats.dayChange >= 0 ? '+' : ''}${stats.dayChange?.toFixed(2)}%`}
            color={stats.dayChange >= 0 ? 'text-gain' : 'text-loss'}
            icon={stats.dayChange >= 0 ? TrendingUp : TrendingDown}
          />
          <StatCard label="52W High" value={`NPR ${stats.high52?.toLocaleString()}`} icon={BarChart3} />
          <StatCard label="52W Low" value={`NPR ${stats.low52?.toLocaleString()}`} icon={BarChart3} />
          <StatCard label="Avg Volume" value={stats.avgVol?.toLocaleString()} icon={BarChart3} />
          <StatCard label="MA20" value={stats.ma20 ? `NPR ${stats.ma20.toFixed(2)}` : '—'} icon={TrendingUp} />
          <StatCard label="MA50" value={stats.ma50 ? `NPR ${stats.ma50.toFixed(2)}` : '—'} icon={TrendingUp} />
          <StatCard label="RSI (14)" value={stats.rsi?.toFixed(1)} color={
            stats.rsi > 70 ? 'text-loss' : stats.rsi < 30 ? 'text-gain' : 'text-warning'
          } subtitle={stats.rsi > 70 ? 'Overbought' : stats.rsi < 30 ? 'Oversold' : 'Neutral'} icon={BarChart3} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color = 'text-[var(--color-primary-text)]', subtitle, icon: Icon }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="h-3.5 w-3.5 text-[var(--color-secondary-text)]" />}
        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-secondary-text)]">{label}</p>
      </div>
      <p className={`text-xl font-mono font-bold ${color}`}>{value || '—'}</p>
      {subtitle && <p className="text-[var(--color-secondary-text)] text-xs mt-0.5">{subtitle}</p>}
    </div>
  );
}

function computeStats(history) {
  if (!history.length) return {};

  const closes = history.map((d) => parseFloat(d.close));
  const volumes = history.map((d) => d.volume);
  const latest = closes[closes.length - 1];
  const prev = closes.length > 1 ? closes[closes.length - 2] : latest;
  const dayChange = prev ? ((latest - prev) / prev) * 100 : 0;

  // 52-week (roughly 252 trading days)
  const last252 = closes.slice(-252);
  const high52 = Math.max(...last252);
  const low52 = Math.min(...last252);

  const avgVol = Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length);

  // MA20, MA50
  const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
  const ma50 = closes.length >= 50 ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 : null;

  // RSI
  const rsi = calcRSI(closes);

  return { latest, dayChange, high52, low52, avgVol, ma20, ma50, rsi };
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  const recent = closes.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
