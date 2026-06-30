import { X } from 'lucide-react';

export default function PortfolioInsightsPanel({ portfolio, totalCurrent, totalPL, totalPLPct, showInsights, setShowInsights }) {
  if (!showInsights || portfolio.length === 0) return null;

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

  const sectorCount = Object.keys(sectorAllocation).length;
  const diversificationScore = Math.min(100, (sectorCount / 5) * 100);

  const overweightSectors = Object.entries(sectorAllocation)
    .filter(([_, value]) => (value / totalCurrent * 100) > 25)
    .map(([sector, _]) => sector);

  const underweightSectors = Object.entries(sectorAllocation)
    .filter(([_, value]) => (value / totalCurrent * 100) < 10)
    .map(([sector, _]) => sector);

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
    <div className="card mb-8 border-2 border-[var(--color-brand)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-primary-text)]">Portfolio Insights</h3>
        <button onClick={() => setShowInsights(false)} className="text-[var(--color-secondary-text)] hover:text-[var(--color-primary-text)] bg-transparent border-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      <InsightSection title="Performance Insights">
        <InsightItem label="Total Return" value={`${totalPLPct >= 0 ? '+' : ''}${totalPLPct.toFixed(2)}%`} valueClass={totalPLPct >= 0 ? 'text-gain' : 'text-loss'} />
        <InsightItem label="Top 3 Gainers">
          <ul className="text-xs">
            {topGainers.map((stock, i) => (
              <li key={i} className="text-gain font-mono">{stock.symbol}: NPR {stock.pl.toFixed(0)}</li>
            ))}
          </ul>
        </InsightItem>
        <InsightItem label="Top 3 Losers">
          <ul className="text-xs">
            {topLosers.map((stock, i) => (
              <li key={i} className="text-loss font-mono">{stock.symbol}: NPR {stock.pl.toFixed(0)}</li>
            ))}
          </ul>
        </InsightItem>
        <InsightItem label="Contribution">
          <ul className="text-xs space-y-1">
            {sortedByPL.slice(0, 3).map((p, i) => {
              const pl = (p.current_price || parseFloat(p.buy_price)) * p.quantity - parseFloat(p.buy_price) * p.quantity;
              const contribution = totalPL !== 0 ? (pl / totalPL * 100) : 0;
              return <li key={i} className="font-mono">{p.stock.symbol}: {contribution.toFixed(1)}%</li>;
            })}
          </ul>
        </InsightItem>
      </InsightSection>

      <InsightSection title="Risk Insights">
        <InsightItem label="Concentration Risk" value={`${concentrationRisk.toFixed(1)}%`} valueClass={concentrationRisk > 30 ? 'text-loss' : 'text-gain'} />
        <InsightItem label="Top Sector" value={topSector ? topSector[0] : 'N/A'} />
        <InsightItem label="Sector Exposure" value={`${sectorExposure.toFixed(1)}%`} />
        <InsightItem label="Stocks Down >15%" value={lossStocks.length} valueClass={lossStocks.length > 0 ? 'text-loss' : 'text-gain'} />
      </InsightSection>

      <InsightSection title="Loss Control Insights">
        <InsightItem label="Down 10-15%" value={loss10_15.length} />
        <InsightItem label="Down >15%" value={loss15plus.length} valueClass={loss15plus.length > 0 ? 'text-loss' : 'text-gain'} />
        <InsightItem label="Avg Loss %" value={`${avgLoss.toFixed(1)}%`} valueClass={avgLoss < -5 ? 'text-loss' : 'text-gain'} />
        <InsightItem label="Losing Stocks" value={allLosses.length} valueClass={allLosses.length > 0 ? 'text-loss' : 'text-gain'} />
      </InsightSection>

      <InsightSection title="Profit Booking Insights">
        <InsightItem label="Up 20-30%" value={profit20_30.length} />
        <InsightItem label="Up >30%" value={profit30plus.length} valueClass="text-gain" />
        <InsightItem label="Avg Profit %" value={`${avgProfit.toFixed(1)}%`} valueClass="text-gain" />
        <InsightItem label="Winning Stocks" value={allProfits.length} valueClass="text-gain" />
      </InsightSection>

      <InsightSection title="Allocation Insights">
        <InsightItem label="Diversification Score" value={`${diversificationScore.toFixed(0)}/100`} valueClass={diversificationScore >= 60 ? 'text-gain' : 'text-loss'} />
        <InsightItem label="Sectors" value={sectorCount} />
        <InsightItem label="Overweight" value={overweightSectors.length} />
        <InsightItem label="Underweight" value={underweightSectors.length} />
      </InsightSection>

      <InsightSection title="Trend Insights">
        <InsightItem label="Portfolio Trend" value={portfolioTrend} valueClass={portfolioTrend === 'Uptrend' ? 'text-gain' : 'text-loss'} />
        <InsightItem label="Above MA20" value={aboveMA20} />
        <InsightItem label="Oversold" value={oversold} />
        <InsightItem label="Overbought" value={overbought} />
      </InsightSection>

      <InsightSection title="Opportunity Insights">
        <InsightItem label="Breakouts" value={breakouts.length} />
        <InsightItem label="Buying Opps" value={buyingOpportunities.length} valueClass="text-gain" />
        <InsightItem label="Momentum" value={momentumStocks.length} valueClass="text-gain" />
        <InsightItem label="Spikes" value={suddenSpikes.length} />
      </InsightSection>
    </div>
  );
}

function InsightSection({ title, children }) {
  return (
    <div className="card mb-4 bg-[var(--color-page-bg)]">
      <h4 className="text-xs font-semibold text-[var(--color-primary-text)] mb-3">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {children}
      </div>
    </div>
  );
}

function InsightItem({ label, value, valueClass, children }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--color-secondary-text)] mb-1">{label}</p>
      {value !== undefined ? (
        <p className={`text-[16px] font-bold font-mono ${valueClass || 'text-[var(--color-primary-text)]'}`}>{value}</p>
      ) : (
        <div className="text-[var(--color-primary-text)]">{children}</div>
      )}
    </div>
  );
}
