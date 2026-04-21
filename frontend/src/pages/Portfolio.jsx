import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPortfolio, addToPortfolio, removeFromPortfolio, getKnownStocks, getPortfolioTransactions, getStockHistory, analyzePortfolio, downloadPortfolioReport } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Briefcase, Plus, Trash2, TrendingUp, TrendingDown, Search, X, DollarSign, PieChart as PieChartIcon, BarChart3, Eye, Loader2, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';

export default function PortfolioPage() {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [form, setForm] = useState({ stock_symbol: '', quantity: '', buy_price: '', buy_date: '', notes: '' });
  
  // Chart and transactions state
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockHistory, setStockHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showChart, setShowChart] = useState(false);

  // Portfolio charts data
  const [portfolioValueHistory, setPortfolioValueHistory] = useState([]);
  const [assetAllocation, setAssetAllocation] = useState([]);
  const [stockContribution, setStockContribution] = useState([]);
  const [plHistory, setPlHistory] = useState([]);

  // AI insights
  const [aiInsights, setAiInsights] = useState('');
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  const [downloadingReport, setDownloadingReport] = useState(false);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Briefcase className="h-12 w-12 text-[var(--color-secondary-text)] mx-auto mb-3" />
          <p className="text-[var(--color-secondary-text)] text-lg">Please login to view your portfolio</p>
          <Link to="/login" className="text-[var(--color-brand)] hover:underline mt-2 inline-block">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await getPortfolio();
      setPortfolio(res.data.results || res.data);
    } catch {}
  }, []);

  const fetchPortfolioChartsData = useCallback(async () => {
    if (portfolio.length === 0) return;

    try {
      // Calculate asset allocation
      const allocation = portfolio.map(p => ({
        name: p.stock.symbol,
        value: (p.current_price || parseFloat(p.buy_price)) * p.quantity
      }));
      setAssetAllocation(allocation);

      // Calculate stock contribution to P/L
      const contribution = portfolio.map(p => ({
        name: p.stock.symbol,
        pl: p.profit_loss || 0,
        plPct: p.profit_loss_pct || 0
      }));
      setStockContribution(contribution);

      // Fetch historical data for portfolio value calculation
      const historyPromises = portfolio.map(async (p) => {
        try {
          const histRes = await getStockHistory(p.stock.symbol);
          return {
            symbol: p.stock.symbol,
            quantity: p.quantity,
            history: histRes.data || []
          };
        } catch {
          return {
            symbol: p.stock.symbol,
            quantity: p.quantity,
            history: []
          };
        }
      });

      const historyResults = await Promise.all(historyPromises);

      // Calculate portfolio value over time (last 30 days)
      const portfolioValueMap = new Map();
      const plMap = new Map();

      historyResults.forEach(({ symbol, quantity, history }) => {
        if (history.length === 0) return;

        history.slice(-30).forEach(day => {
          const date = day.date;
          const value = parseFloat(day.close) * quantity;

          if (portfolioValueMap.has(date)) {
            portfolioValueMap.set(date, portfolioValueMap.get(date) + value);
          } else {
            portfolioValueMap.set(date, value);
          }
        });
      });

      const portfolioValueData = Array.from(portfolioValueMap.entries())
        .map(([date, value]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: value
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      setPortfolioValueHistory(portfolioValueData);

      // Calculate P/L history
      const invested = portfolio.reduce((sum, p) => sum + parseFloat(p.buy_price) * p.quantity, 0);
      const plData = portfolioValueData.map(d => ({
        date: d.date,
        pl: d.value - invested,
        plPct: invested > 0 ? ((d.value - invested) / invested) * 100 : 0
      }));
      setPlHistory(plData);

    } catch (error) {
      console.error('Error fetching portfolio chart data:', error);
    }
  }, [portfolio]);

  useEffect(() => {
    fetchPortfolio().finally(() => setLoading(false));
  }, [fetchPortfolio]);

  useEffect(() => {
    fetchPortfolioChartsData();
  }, [fetchPortfolioChartsData]);

  useEffect(() => {
    if (search.length < 1) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await getKnownStocks(search);
        setSuggestions(res.data.slice(0, 8));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.stock_symbol || !form.quantity || !form.buy_price || !form.buy_date) {
      alert('Please fill all required fields');
      return;
    }
    
    // Convert form data to proper types
    const submitData = {
      ...form,
      quantity: parseInt(form.quantity),
      buy_price: parseFloat(form.buy_price),
    };
    
    console.log('Submitting portfolio data:', submitData);
    
    try {
      await addToPortfolio(submitData);
      setForm({ stock_symbol: '', quantity: '', buy_price: '', buy_date: '', notes: '' });
      setShowAdd(false);
      setSearch('');
      setSuggestions([]);
      fetchPortfolio();
    } catch (err) {
      console.error('Portfolio add error:', err);
      console.error('Error response:', err.response?.data);
      const errorMsg = err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 
                      Object.values(err.response?.data || {}).flat().join(', ') ||
                      'Failed to add to portfolio';
      alert(errorMsg);
    }
  };

  const handleRemove = async (id) => {
    try { await removeFromPortfolio(id); fetchPortfolio(); } catch {}
  };

  const showStockChart = async (stockSymbol) => {
    setSelectedStock(stockSymbol);
    setShowChart(true);
    
    // Fetch stock history for chart
    try {
      const histRes = await getStockHistory(stockSymbol);
      const chartData = histRes.data.slice(-60).map(d => ({
        date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        price: parseFloat(d.close),
      }));
      setStockHistory(chartData);
    } catch {
      setStockHistory([]);
    }
    
    // Fetch transactions for this stock
    try {
      const transRes = await getPortfolioTransactions(stockSymbol);
      setTransactions(transRes.data);
    } catch {
      setTransactions([]);
    }
  };

  const closeChart = () => {
    setShowChart(false);
    setSelectedStock(null);
    setStockHistory([]);
    setTransactions([]);
  };

  const handleGetAIInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await analyzePortfolio();
      const analysis = res.data?.analysis || res.data || 'No analysis returned';
      setAiInsights(String(analysis));
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to generate insights. Please make sure Ollama is running.';
      setAiInsights(`Error: ${errorMsg}`);
    }
    setLoadingInsights(false);
  };

  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      // Auto-generate AI insights if not already generated
      let insightsToUse = aiInsights;
      if (!insightsToUse) {
        setLoadingInsights(true);
        try {
          const res = await analyzePortfolio();
          insightsToUse = res.data?.analysis || res.data || 'No analysis returned';
          setAiInsights(String(insightsToUse));
        } catch (error) {
          console.error('Error auto-generating AI insights:', error);
          insightsToUse = 'AI insights generation failed';
        }
        setLoadingInsights(false);
      }

      // Prepare holdings data
      const holdingsData = portfolio.map(p => ({
        symbol: p.stock.symbol,
        quantity: p.quantity,
        buy_price: parseFloat(p.buy_price),
        current_price: p.current_price || parseFloat(p.buy_price),
        pl: (p.current_price || parseFloat(p.buy_price)) * p.quantity - parseFloat(p.buy_price) * p.quantity,
        pl_pct: ((p.current_price || parseFloat(p.buy_price)) - parseFloat(p.buy_price)) / parseFloat(p.buy_price) * 100
      }));

      // Prepare asset allocation data
      const sectorAllocation = {};
      portfolio.forEach(p => {
        const sector = p.stock.sector || 'Other';
        const value = (p.current_price || parseFloat(p.buy_price)) * p.quantity;
        sectorAllocation[sector] = (sectorAllocation[sector] || 0) + value;
      });
      const assetAllocationData = Object.entries(sectorAllocation).map(([name, value]) => ({ name, value }));

      // Prepare stock contribution data
      const sortedByPL = [...portfolio].sort((a, b) => {
        const plA = (a.current_price || parseFloat(a.buy_price)) * a.quantity - parseFloat(a.buy_price) * a.quantity;
        const plB = (b.current_price || parseFloat(b.buy_price)) * b.quantity - parseFloat(b.buy_price) * b.quantity;
        return plB - plA;
      });
      const stockContributionData = sortedByPL.map(p => ({
        symbol: p.stock.symbol,
        pl: (p.current_price || parseFloat(p.buy_price)) * p.quantity - parseFloat(p.buy_price) * p.quantity
      }));

      const portfolioData = {
        total_invested: totalInvested,
        total_current: totalCurrent,
        total_pl: totalPL,
        total_pl_pct: totalPLPct
      };

      const res = await downloadPortfolioReport({
        portfolio_data: portfolioData,
        ai_insights: insightsToUse,
        holdings: holdingsData,
        asset_allocation: assetAllocationData,
        stock_contribution: stockContributionData
      });

      // Create download link
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portfolio_report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Failed to download report. Please try again.');
    } finally {
      setDownloadingReport(false);
    }
  };

  const selectStock = (symbol) => {
    setForm({ ...form, stock_symbol: symbol });
    setSearch('');
    setSuggestions([]);
  };

  // Summary
  const totalInvested = portfolio.reduce((s, p) => s + parseFloat(p.buy_price) * p.quantity, 0);
  const totalCurrent = portfolio.reduce((s, p) => s + (p.current_price || parseFloat(p.buy_price)) * p.quantity, 0);
  const totalPL = totalCurrent - totalInvested;
  const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner h-8 w-8" /></div>;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-[var(--color-primary-text)] flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-[var(--color-brand)]" />
            Portfolio
          </h1>
          <p className="text-[var(--color-secondary-text)] mt-1">Track your NEPSE investments</p>
        </div>
        <div className="flex items-center gap-2">
          {portfolio.length > 0 && (
            <button
              onClick={handleDownloadReport}
              disabled={downloadingReport}
              className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {downloadingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloadingReport ? 'Downloading...' : 'Download Report'}
            </button>
          )}
          {portfolio.length > 0 && (
            <button
              onClick={() => setShowInsights(!showInsights)}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <BarChart3 className="h-4 w-4" />
              {showInsights ? 'Hide Insights' : 'Show Insights'}
            </button>
          )}
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="btn-primary flex items-center gap-2"
          >
            {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAdd ? 'Cancel' : 'Add Holding'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {portfolio.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <SummaryCard label="Total Invested" value={`NPR ${totalInvested.toLocaleString(undefined, {maximumFractionDigits: 0})}`} icon={DollarSign} />
          <SummaryCard label="Current Value" value={`NPR ${totalCurrent.toLocaleString(undefined, {maximumFractionDigits: 0})}`} icon={PieChartIcon} />
          <SummaryCard
            label="Total P/L"
            value={`${totalPL >= 0 ? '+' : ''}NPR ${totalPL.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
            color={totalPL >= 0 ? 'text-gain' : 'text-loss'}
            icon={totalPL >= 0 ? TrendingUp : TrendingDown}
          />
          <SummaryCard
            label="Return %"
            value={`${totalPLPct >= 0 ? '+' : ''}${totalPLPct.toFixed(2)}%`}
            color={totalPLPct >= 0 ? 'text-gain' : 'text-loss'}
            icon={totalPLPct >= 0 ? TrendingUp : TrendingDown}
          />
        </div>
      )}

      {/* Portfolio Charts */}
      {portfolio.length > 0 && (
        <>
          {/* AI Insights Section */}
          <div className="card mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--color-primary-text)]">AI Portfolio Insights</h3>
              <button
                onClick={handleGetAIInsights}
                disabled={loadingInsights}
                className="btn-secondary flex items-center gap-2 text-xs disabled:opacity-50"
              >
                {loadingInsights ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
                {loadingInsights ? 'Generating...' : 'Generate Insights'}
              </button>
            </div>
            {aiInsights ? (
              <div className="text-sm text-[var(--color-primary-text)] bg-[var(--color-card-bg)] p-4 rounded-lg border border-[var(--color-border)]">
                {aiInsights}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-secondary-text)]">Click "Generate Insights" to get AI-powered portfolio analysis</p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Portfolio Value Line Chart */}
          <div className="card">
            <h3 className="text-sm font-semibold text-[var(--color-primary-text)] mb-4">Portfolio Value (Last 30 Days)</h3>
            {portfolioValueHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={portfolioValueHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" stroke="var(--color-secondary-text)" fontSize={12} />
                  <YAxis stroke="var(--color-secondary-text)" fontSize={12} tickFormatter={(value) => `NPR ${(value / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-border)' }}
                    labelStyle={{ color: 'var(--color-primary-text)' }}
                    formatter={(value) => `NPR ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-brand)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-[var(--color-secondary-text)]">
                No portfolio value data available
              </div>
            )}
          </div>

          {/* Asset Allocation Pie Chart */}
          <div className="card">
            <h3 className="text-sm font-semibold text-[var(--color-primary-text)] mb-4">Asset Allocation</h3>
            {assetAllocation.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={assetAllocation}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {assetAllocation.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-border)' }}
                    labelStyle={{ color: 'var(--color-primary-text)' }}
                    formatter={(value) => `NPR ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-[var(--color-secondary-text)]">
                No allocation data available
              </div>
            )}
          </div>

          {/* Stock Contribution Bar Chart */}
          <div className="card">
            <h3 className="text-sm font-semibold text-[var(--color-primary-text)] mb-4">Stock Contribution to P/L</h3>
            {stockContribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stockContribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-secondary-text)" fontSize={12} />
                  <YAxis stroke="var(--color-secondary-text)" fontSize={12} tickFormatter={(value) => `NPR ${(value / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-border)' }}
                    labelStyle={{ color: 'var(--color-primary-text)' }}
                    formatter={(value) => `NPR ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  />
                  <Bar dataKey="pl" name="P/L">
                    {stockContribution.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.pl >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-[var(--color-secondary-text)]">
                No contribution data available
              </div>
            )}
          </div>

          {/* P&L Line Chart */}
          <div className="card">
            <h3 className="text-sm font-semibold text-[var(--color-primary-text)] mb-4">P&L History (Last 30 Days)</h3>
            {plHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={plHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" stroke="var(--color-secondary-text)" fontSize={12} />
                  <YAxis stroke="var(--color-secondary-text)" fontSize={12} tickFormatter={(value) => `NPR ${(value / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-border)' }}
                    labelStyle={{ color: 'var(--color-primary-text)' }}
                    formatter={(value) => `NPR ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="pl"
                    stroke={totalPL >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-[var(--color-secondary-text)]">
                No P&L data available
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {/* Add Form */}
      {showAdd && (
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
      )}

      {/* Holdings Table */}
      {portfolio.length === 0 ? (
        <div className="card border-dashed flex flex-col items-center justify-center p-12">
          <Briefcase className="h-12 w-12 text-[var(--color-secondary-text)] mx-auto mb-3" />
          <p className="text-[var(--color-secondary-text)] text-lg">No holdings yet</p>
          <p className="text-[var(--color-secondary-text)] text-sm mt-1">Add your stock purchases to track P/L</p>
        </div>
      ) : (
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
      )}

      {/* Collapsible Insights Box */}
      {showInsights && portfolio.length > 0 && (
        <div className="card mb-8 border-2 border-[var(--color-brand)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-primary-text)]">📊 Portfolio Insights</h3>
            <button
              onClick={() => setShowInsights(false)}
              className="text-[var(--color-secondary-text)] hover:text-[var(--color-primary-text)] bg-transparent border-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Performance Insights */}
          <div className="card mb-4 bg-[var(--color-page-bg)]">
            <h4 className="text-xs font-semibold text-[var(--color-primary-text)] mb-3">📊 Performance Insights</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                const sortedByPL = [...portfolio].sort((a, b) => {
                  const plA = (a.current_price || parseFloat(a.buy_price)) * a.quantity - parseFloat(a.buy_price) * a.quantity;
                  const plB = (b.current_price || parseFloat(b.buy_price)) * b.quantity - parseFloat(b.buy_price) * b.quantity;
                  return plB - plA;
                });

                const topGainers = sortedByPL.slice(0, 3).map(p => ({
                  symbol: p.stock.symbol,
                  pl: ((p.current_price || parseFloat(p.buy_price)) * p.quantity - parseFloat(p.buy_price) * p.quantity)
                }));

                const topLosers = sortedByPL.slice(-3).reverse().map(p => ({
                  symbol: p.stock.symbol,
                  pl: ((p.current_price || parseFloat(p.buy_price)) * p.quantity - parseFloat(p.buy_price) * p.quantity)
                }));

                return (
                  <>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Total Return</p>
                      <p className={`text-[16px] font-bold font-mono ${totalPLPct >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {totalPLPct >= 0 ? '+' : ''}{totalPLPct.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Top 3 Gainers</p>
                      <ul className="text-xs">
                        {topGainers.map((stock, i) => (
                          <li key={i} className="text-gain font-mono">
                            {stock.symbol}: NPR {stock.pl.toFixed(0)}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Top 3 Losers</p>
                      <ul className="text-xs">
                        {topLosers.map((stock, i) => (
                          <li key={i} className="text-loss font-mono">
                            {stock.symbol}: NPR {stock.pl.toFixed(0)}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Stock-wise Contribution</p>
                      <ul className="text-xs space-y-1">
                        {sortedByPL.slice(0, 3).map((p, i) => {
                          const pl = (p.current_price || parseFloat(p.buy_price)) * p.quantity - parseFloat(p.buy_price) * p.quantity;
                          const contribution = totalPL !== 0 ? (pl / totalPL * 100) : 0;
                          return (
                            <li key={i} className="font-mono">
                              {p.stock.symbol}: {contribution.toFixed(1)}%
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Risk Insights */}
          <div className="card mb-4 bg-[var(--color-page-bg)]">
            <h4 className="text-xs font-semibold text-[var(--color-primary-text)] mb-3">⚠️ Risk Insights</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                const positionValues = portfolio.map(p => (p.current_price || parseFloat(p.buy_price)) * p.quantity);
                const maxPosition = Math.max(...positionValues);
                const concentrationRisk = totalCurrent > 0 ? (maxPosition / totalCurrent * 100) : 0;

                const sectorAllocation = {};
                portfolio.forEach(p => {
                  const sector = p.stock.sector || 'Other';
                  const value = (p.current_price || parseFloat(p.buy_price)) * p.quantity;
                  sectorAllocation[sector] = (sectorAllocation[sector] || 0) + value;
                });

                const topSector = Object.entries(sectorAllocation).sort((a, b) => b[1] - a[1])[0];
                const sectorExposure = topSector ? (topSector[1] / totalCurrent * 100) : 0;

                const lossStocks = portfolio.filter(p => {
                  const current = p.current_price || parseFloat(p.buy_price);
                  const buy = parseFloat(p.buy_price);
                  return ((current - buy) / buy * 100) < -15;
                });

                return (
                  <>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Concentration Risk</p>
                      <p className={`text-[16px] font-bold font-mono ${concentrationRisk > 30 ? 'text-loss' : 'text-gain'}`}>
                        {concentrationRisk.toFixed(1)}%
                      </p>
                      <p className="text-xs text-[var(--color-secondary-text)] mt-1">
                        {concentrationRisk > 30 ? '⚠️ High' : '✓ Good'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Top Sector</p>
                      <p className="text-[16px] font-bold font-mono">
                        {topSector ? topSector[0] : 'N/A'}
                      </p>
                      <p className="text-xs text-[var(--color-secondary-text)] mt-1">
                        {sectorExposure.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Stocks Down &gt;15%</p>
                      <p className={`text-[16px] font-bold font-mono ${lossStocks.length > 0 ? 'text-loss' : 'text-gain'}`}>
                        {lossStocks.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Holdings</p>
                      <p className="text-[16px] font-bold font-mono">{portfolio.length}</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Loss Control Insights */}
          <div className="card mb-4 bg-[var(--color-page-bg)]">
            <h4 className="text-xs font-semibold text-[var(--color-primary-text)] mb-3">💀 Loss Control Insights</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                const loss10_15 = portfolio.filter(p => {
                  const current = p.current_price || parseFloat(p.buy_price);
                  const buy = parseFloat(p.buy_price);
                  const pctChange = ((current - buy) / buy * 100);
                  return pctChange < -10 && pctChange >= -15;
                });

                const loss15plus = portfolio.filter(p => {
                  const current = p.current_price || parseFloat(p.buy_price);
                  const buy = parseFloat(p.buy_price);
                  return ((current - buy) / buy * 100) < -15;
                });

                const allLosses = portfolio.map(p => {
                  const current = p.current_price || parseFloat(p.buy_price);
                  const buy = parseFloat(p.buy_price);
                  return ((current - buy) / buy * 100);
                }).filter(pct => pct < 0);

                const avgLoss = allLosses.length > 0 ? allLosses.reduce((a, b) => a + b, 0) / allLosses.length : 0;

                return (
                  <>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Down 10-15%</p>
                      <p className="text-[16px] font-bold font-mono">{loss10_15.length}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Down &gt;15%</p>
                      <p className={`text-[16px] font-bold font-mono ${loss15plus.length > 0 ? 'text-loss' : 'text-gain'}`}>
                        {loss15plus.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Avg Loss %</p>
                      <p className={`text-[16px] font-bold font-mono ${avgLoss < -5 ? 'text-loss' : 'text-gain'}`}>
                        {avgLoss.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Losing Stocks</p>
                      <p className={`text-[16px] font-bold font-mono ${allLosses.length > 0 ? 'text-loss' : 'text-gain'}`}>
                        {allLosses.length}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Profit Booking Insights */}
          <div className="card mb-4 bg-[var(--color-page-bg)]">
            <h4 className="text-xs font-semibold text-[var(--color-primary-text)] mb-3">💰 Profit Booking Insights</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                const profit20_30 = portfolio.filter(p => {
                  const current = p.current_price || parseFloat(p.buy_price);
                  const buy = parseFloat(p.buy_price);
                  const pctChange = ((current - buy) / buy * 100);
                  return pctChange >= 20 && pctChange < 30;
                });

                const profit30plus = portfolio.filter(p => {
                  const current = p.current_price || parseFloat(p.buy_price);
                  const buy = parseFloat(p.buy_price);
                  return ((current - buy) / buy * 100) >= 30;
                });

                const allProfits = portfolio.map(p => {
                  const current = p.current_price || parseFloat(p.buy_price);
                  const buy = parseFloat(p.buy_price);
                  return ((current - buy) / buy * 100);
                }).filter(pct => pct > 0);

                const avgProfit = allProfits.length > 0 ? allProfits.reduce((a, b) => a + b, 0) / allProfits.length : 0;

                return (
                  <>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Up 20-30%</p>
                      <p className="text-[16px] font-bold font-mono">{profit20_30.length}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Up &gt;30%</p>
                      <p className="text-[16px] font-bold font-mono text-gain">{profit30plus.length}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Avg Profit %</p>
                      <p className="text-[16px] font-bold font-mono text-gain">{avgProfit.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Winning Stocks</p>
                      <p className="text-[16px] font-bold font-mono text-gain">{allProfits.length}</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Allocation Insights */}
          <div className="card mb-4 bg-[var(--color-page-bg)]">
            <h4 className="text-xs font-semibold text-[var(--color-primary-text)] mb-3">🧩 Allocation Insights</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                const sectorAllocation = {};
                portfolio.forEach(p => {
                  const sector = p.stock.sector || 'Other';
                  const value = (p.current_price || parseFloat(p.buy_price)) * p.quantity;
                  sectorAllocation[sector] = (sectorAllocation[sector] || 0) + value;
                });

                const sectorCount = Object.keys(sectorAllocation).length;
                const diversificationScore = Math.min(100, (sectorCount / 5) * 100);

                const overweightSectors = Object.entries(sectorAllocation)
                  .filter(([_, value]) => (value / totalCurrent * 100) > 25)
                  .map(([sector, _]) => sector);

                const underweightSectors = Object.entries(sectorAllocation)
                  .filter(([_, value]) => (value / totalCurrent * 100) < 10)
                  .map(([sector, _]) => sector);

                return (
                  <>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Diversification Score</p>
                      <p className={`text-[16px] font-bold font-mono ${diversificationScore >= 60 ? 'text-gain' : 'text-loss'}`}>
                        {diversificationScore.toFixed(0)}/100
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Sectors</p>
                      <p className="text-[16px] font-bold font-mono">{sectorCount}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Overweight</p>
                      <p className="text-[16px] font-bold font-mono">{overweightSectors.length}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Underweight</p>
                      <p className="text-[16px] font-bold font-mono">{underweightSectors.length}</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Trend Insights */}
          <div className="card mb-4 bg-[var(--color-page-bg)]">
            <h4 className="text-xs font-semibold text-[var(--color-primary-text)] mb-3">📈 Trend Insights</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                const aboveMA20 = portfolio.filter(p => {
                  const pctChange = ((p.current_price || parseFloat(p.buy_price)) - parseFloat(p.buy_price)) / parseFloat(p.buy_price) * 100;
                  return pctChange > 0;
                }).length;

                const oversold = portfolio.filter(p => {
                  const pctChange = ((p.current_price || parseFloat(p.buy_price)) - parseFloat(p.buy_price)) / parseFloat(p.buy_price) * 100;
                  return pctChange < -20;
                }).length;

                const overbought = portfolio.filter(p => {
                  const pctChange = ((p.current_price || parseFloat(p.buy_price)) - parseFloat(p.buy_price)) / parseFloat(p.buy_price) * 100;
                  return pctChange > 30;
                }).length;

                const portfolioTrend = totalPLPct > 0 ? 'Uptrend' : 'Downtrend';

                return (
                  <>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Portfolio Trend</p>
                      <p className={`text-[16px] font-bold font-mono ${portfolioTrend === 'Uptrend' ? 'text-gain' : 'text-loss'}`}>
                        {portfolioTrend}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Above MA20</p>
                      <p className="text-[16px] font-bold font-mono">{aboveMA20}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Oversold</p>
                      <p className="text-[16px] font-bold font-mono">{oversold}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Overbought</p>
                      <p className="text-[16px] font-bold font-mono">{overbought}</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Opportunity Insights */}
          <div className="card bg-[var(--color-page-bg)]">
            <h4 className="text-xs font-semibold text-[var(--color-primary-text)] mb-3">🔥 Opportunity Insights</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                const breakouts = portfolio.filter(p => {
                  const pctChange = ((p.current_price || parseFloat(p.buy_price)) - parseFloat(p.buy_price)) / parseFloat(p.buy_price) * 100;
                  return pctChange >= 10 && pctChange < 20;
                });

                const buyingOpportunities = portfolio.filter(p => {
                  const pctChange = ((p.current_price || parseFloat(p.buy_price)) - parseFloat(p.buy_price)) / parseFloat(p.buy_price) * 100;
                  return pctChange < -15 && pctChange >= -25;
                });

                const momentumStocks = portfolio.filter(p => {
                  const pctChange = ((p.current_price || parseFloat(p.buy_price)) - parseFloat(p.buy_price)) / parseFloat(p.buy_price) * 100;
                  return pctChange > 25;
                });

                const suddenSpikes = portfolio.filter(p => {
                  const pctChange = ((p.current_price || parseFloat(p.buy_price)) - parseFloat(p.buy_price)) / parseFloat(p.buy_price) * 100;
                  return pctChange > 20;
                });

                return (
                  <>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Breakouts</p>
                      <p className="text-[16px] font-bold font-mono">{breakouts.length}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Buying Opps</p>
                      <p className="text-[16px] font-bold font-mono text-gain">{buyingOpportunities.length}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Momentum</p>
                      <p className="text-[16px] font-bold font-mono text-gain">{momentumStocks.length}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">Spikes</p>
                      <p className="text-[16px] font-bold font-mono">{suddenSpikes.length}</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Chart Modal */}
      {showChart && selectedStock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-page-bg)] border border-[var(--color-border)] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[var(--color-page-bg)] border-b border-[var(--color-border)] p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--color-primary-text)]">{selectedStock} - Chart & Transactions</h3>
              <button onClick={closeChart} className="text-[var(--color-secondary-text)] hover:text-[var(--color-primary-text)] bg-transparent border-0">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4">
              {/* Chart */}
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
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="var(--color-gain)" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-[var(--color-secondary-text)]">
                    No chart data available
                  </div>
                )}
              </div>

              {/* Transactions */}
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
                            <td className="text-right font-mono">
                              NPR {(parseFloat(t.buy_price) * t.quantity).toLocaleString()}
                            </td>
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
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-secondary-text)]">{label}</p>
          <p className={`text-[16px] font-mono font-bold mt-1 ${color || 'text-[var(--color-primary-text)]'}`}>{value}</p>
        </div>
        <Icon className={`h-6 w-6 ${color || 'text-[var(--color-secondary-text)]'}`} />
      </div>
    </div>
  );
}
