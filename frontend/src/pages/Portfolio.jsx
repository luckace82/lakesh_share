import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPortfolio, addToPortfolio, removeFromPortfolio, getKnownStocks, getPortfolioTransactions, getStockHistory, analyzePortfolio, downloadPortfolioReport } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Briefcase, Plus, X, BarChart3, Download, Loader2 } from 'lucide-react';
import PortfolioSummaryCards from '../components/portfolio/PortfolioSummaryCards';
import PortfolioCharts from '../components/portfolio/PortfolioCharts';
import AddHoldingForm from '../components/portfolio/AddHoldingForm';
import HoldingsTable from '../components/portfolio/HoldingsTable';
import PortfolioInsightsPanel from '../components/portfolio/PortfolioInsightsPanel';
import TransactionModal from '../components/portfolio/TransactionModal';

export default function PortfolioPage() {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [form, setForm] = useState({ stock_symbol: '', quantity: '', buy_price: '', buy_date: '', notes: '' });

  const [selectedStock, setSelectedStock] = useState(null);
  const [stockHistory, setStockHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showChart, setShowChart] = useState(false);

  const [portfolioValueHistory, setPortfolioValueHistory] = useState([]);
  const [assetAllocation, setAssetAllocation] = useState([]);
  const [stockContribution, setStockContribution] = useState([]);
  const [plHistory, setPlHistory] = useState([]);

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
      setPortfolio(res.data);

      const historyPromises = res.data.map(async (p) => {
        if (p.stock.symbol.includes('/')) {
          return { symbol: p.stock.symbol, history: [] };
        }
        try {
          const histRes = await getStockHistory(p.stock.symbol);
          return { symbol: p.stock.symbol, history: histRes.data };
        } catch {
          return { symbol: p.stock.symbol, history: [] };
        }
      });

      const historyResults = await Promise.all(historyPromises);
      const historyMap = {};
      historyResults.forEach(({ symbol, history }) => {
        historyMap[symbol] = history;
      });

      // Calculate portfolio value over time (last 30 days)
      const portfolioValueMap = new Map();
      const plMap = new Map();

      res.data.forEach((p) => {
        const symbolHistory = historyMap[p.stock.symbol] || [];
        symbolHistory.forEach((h) => {
          const date = h.date;
          const price = parseFloat(h.close);
          const invested = parseFloat(p.buy_price) * p.quantity;
          const current = price * p.quantity;

          portfolioValueMap.set(date, (portfolioValueMap.get(date) || 0) + current);
          plMap.set(date, (plMap.get(date) || 0) + (current - invested));
        });
      });

      const sortedDates = Array.from(portfolioValueMap.keys()).sort();
      const last30 = sortedDates.slice(-30);

      setPortfolioValueHistory(last30.map(date => ({
        date,
        value: portfolioValueMap.get(date) || 0
      })));

      setPlHistory(last30.map(date => ({
        date,
        pl: plMap.get(date) || 0
      })));

      // Asset allocation
      const allocation = res.data.map(p => ({
        name: p.stock.symbol,
        value: (p.current_price || parseFloat(p.buy_price)) * p.quantity
      })).filter(a => a.value > 0);
      setAssetAllocation(allocation);

      // Stock contribution
      const contribution = res.data.map(p => {
        const invested = parseFloat(p.buy_price) * p.quantity;
        const current = (p.current_price || parseFloat(p.buy_price)) * p.quantity;
        return {
          name: p.stock.symbol,
          pl: current - invested
        };
      });
      setStockContribution(contribution);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    }
  }, []);

  useEffect(() => {
    fetchPortfolio().finally(() => setLoading(false));
  }, [fetchPortfolio]);

  useEffect(() => {
    if (!search) { setSuggestions([]); return; }
    const timeout = setTimeout(async () => {
      try {
        const res = await getKnownStocks(search);
        setSuggestions(res.data.filter(s => !portfolio.find(p => p.stock.symbol === s.symbol)));
      } catch {}
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, portfolio]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.stock_symbol || !form.quantity || !form.buy_price) return;
    try {
      await addToPortfolio({
        stock_symbol: form.stock_symbol,
        quantity: parseInt(form.quantity),
        buy_price: parseFloat(form.buy_price),
        buy_date: form.buy_date || new Date().toISOString().split('T')[0],
        notes: form.notes
      });
      setForm({ stock_symbol: '', quantity: '', buy_price: '', buy_date: '', notes: '' });
      setShowAdd(false);
      fetchPortfolio();
    } catch (error) {
      console.error('Error adding to portfolio:', error);
      alert('Failed to add holding. Please try again.');
    }
  };

  const handleRemove = async (id) => {
    if (!confirm('Are you sure you want to remove this holding?')) return;
    try {
      await removeFromPortfolio(id);
      fetchPortfolio();
    } catch (error) {
      console.error('Error removing from portfolio:', error);
    }
  };

  const showStockChart = async (symbol) => {
    setSelectedStock(symbol);
    setShowChart(true);
    if (symbol.includes('/')) {
      setStockHistory([]);
      setTransactions([]);
      return;
    }
    try {
      const [histRes, transRes] = await Promise.all([
        getStockHistory(symbol, 60),
        getPortfolioTransactions(symbol)
      ]);
      setStockHistory(histRes.data.map(h => ({ date: h.date, price: parseFloat(h.close) })));
      setTransactions(transRes.data);
    } catch (error) {
      console.error('Error fetching stock details:', error);
    }
  };

  const closeChart = () => {
    setShowChart(false);
    setSelectedStock(null);
    setStockHistory([]);
    setTransactions([]);
  };

  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await analyzePortfolio();
      setAiInsights(res.data.insights);
    } catch (error) {
      console.error('Error generating insights:', error);
      setAiInsights('Failed to generate insights. Please try again.');
    }
    setLoadingInsights(false);
  };

  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      const res = await downloadPortfolioReport();
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

  const totalInvested = portfolio.reduce((s, p) => s + parseFloat(p.buy_price) * p.quantity, 0);
  const totalCurrent = portfolio.reduce((s, p) => s + (p.current_price || parseFloat(p.buy_price)) * p.quantity, 0);
  const totalPL = totalCurrent - totalInvested;
  const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner h-8 w-8" /></div>;
  }

  return (
    <div>
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

      {/* AI Insights */}
      {portfolio.length > 0 && (
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-primary-text)]">AI Portfolio Insights</h3>
            <button
              onClick={handleGenerateInsights}
              disabled={loadingInsights}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {loadingInsights ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : null}
              {loadingInsights ? 'Generating...' : 'Generate Insights'}
            </button>
          </div>
          {aiInsights ? (
            <div className="text-sm text-[var(--color-primary-text)] whitespace-pre-line">{aiInsights}</div>
          ) : (
            <p className="text-sm text-[var(--color-secondary-text)]">Click "Generate Insights" to get AI-powered portfolio analysis</p>
          )}
        </div>
      )}

      {portfolio.length > 0 && (
        <PortfolioSummaryCards
          totalInvested={totalInvested}
          totalCurrent={totalCurrent}
          totalPL={totalPL}
          totalPLPct={totalPLPct}
        />
      )}

      {portfolio.length > 0 && (
        <PortfolioCharts
          portfolioValueHistory={portfolioValueHistory}
          assetAllocation={assetAllocation}
          stockContribution={stockContribution}
          plHistory={plHistory}
          totalPL={totalPL}
        />
      )}

      {showAdd && (
        <AddHoldingForm
          form={form}
          setForm={setForm}
          search={search}
          setSearch={setSearch}
          suggestions={suggestions}
          selectStock={selectStock}
          handleAdd={handleAdd}
        />
      )}

      <HoldingsTable
        portfolio={portfolio}
        showStockChart={showStockChart}
        handleRemove={handleRemove}
      />

      <PortfolioInsightsPanel
        portfolio={portfolio}
        totalCurrent={totalCurrent}
        totalPL={totalPL}
        totalPLPct={totalPLPct}
        showInsights={showInsights}
        setShowInsights={setShowInsights}
      />

      <TransactionModal
        show={showChart}
        onClose={closeChart}
        selectedStock={selectedStock}
        stockHistory={stockHistory}
        transactions={transactions}
      />
    </div>
  );
}
