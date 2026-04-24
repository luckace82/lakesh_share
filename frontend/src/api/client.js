import axios from 'axios';

const API_BASE = 'http://192.168.1.93:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — try refresh token
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const res = await axios.post(`${API_BASE}/auth/refresh/`, { refresh });
          localStorage.setItem('access_token', res.data.access);
          original.headers.Authorization = `Bearer ${res.data.access}`;
          return api(original);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (data) => api.post('/auth/login/', data);
export const register = (data) => api.post('/auth/register/', data);
export const getMe = () => api.get('/auth/me/');

// Stocks
export const getStocks = (params) => api.get('/stocks/', { params });
export const getKnownStocks = (search) => api.get('/stocks/known/', { params: { search } });
export const getStockDetail = (symbol) => api.get(`/stocks/${symbol}/`);
export const getStockHistory = (symbol, days) => api.get(`/stocks/${symbol}/history/`, { params: { days } });
export const getStockLive = (symbol) => api.get(`/stocks/${symbol}/live/`);
export const getAllStocksWithPrices = (params) => api.get('/stocks/all/', { params });

// Scraping
export const triggerScrape = (symbol) => api.post(`/stocks/${symbol}/scrape/`);
export const getScrapeStatus = (symbol) => api.get(`/scrape-jobs/${symbol}/status/`);

// Watchlist
export const getWatchlist = () => api.get('/watchlist/');
export const addToWatchlist = (symbol) => api.post('/watchlist/', { stock_symbol: symbol });
export const removeFromWatchlist = (symbol) => api.delete(`/watchlist/${symbol}/`);
export const autoScrapeWatchlist = () => api.post('/watchlist/auto-scrape/');
export const scrapeAllStocks = () => api.post('/scrape-all/');
export const getBulkScrapeProgress = () => api.get('/scrape-all/progress/');
export const getScrapedStocksList = () => api.get('/scraped-stocks/');

// Portfolio
export const addToPortfolio = (data) => api.post('/portfolio/', data);
export const removeFromPortfolio = (id) => api.delete(`/portfolio/${id}/`);
export const getPortfolioTransactions = (symbol) => api.get(`/portfolio/${symbol}/transactions/`);
export const getPortfolio = () => api.get('/portfolio/');
export const downloadPortfolioReport = (data) => api.post('/portfolio/download-report/', data, { responseType: 'blob' });

// AI
export const analyzeStock = (symbol, message) => api.post('/ai/analyze/', { symbol, message });
export const analyzePortfolio = () => api.post('/ai/analyze/', { type: 'portfolio' });
export const autoScreener = (data) => api.post('/screener/auto/', data);
export const getAIScreeningProgress = () => api.get('/screener/auto/progress/');

// NEPSE Index
export const getNEPSEIndexData = (range) => api.get('/nepse-index/', { params: { range } });
export const scrapeNEPSEIndex = () => api.post('/nepse-index/scrape/');
export const getNEPSEInsights = (range) => api.get('/nepse-index/insights/', { params: { range } });
export const generateNEPSEInsights = () => api.post('/nepse-index/insights/generate/');
export const getNEPSEPredictions = () => api.get('/nepse-index/predictions/');
export const getNEPSEIndexStats = () => api.get('/nepse-index/stats/');
export const generateNEPSEPrediction = () => api.post('/nepse-index/predict/');
export const getMarketStats = () => api.get('/market-stats/');

// Download helper
export const downloadCSV = (symbol, history) => {
  const header = 'Date,Open,High,Low,Close,Volume\n';
  const rows = history.map(d => `${d.date},${d.open},${d.high},${d.low},${d.close},${d.volume}`).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${symbol}_history.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export default api;
