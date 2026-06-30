import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import StockDetail from './pages/StockDetail';
import PortfolioPage from './pages/Portfolio';
import Screener from './pages/Screener';
import Watchlist from './pages/Watchlist';
import AllStocks from './pages/AllStocks';
import Chat from './pages/Chat';
import { Menu } from 'lucide-react';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="spinner h-8 w-8" /></div>;
  return user ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--color-page-bg)]">
        <div className="spinner h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {user ? (
        <div className="flex">
          <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
          {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}
          <main className="main-content flex-1 p-6">
            {/* Mobile header */}
            <div className="md:hidden flex items-center gap-3 mb-4">
              <button
                onClick={() => setMobileOpen(true)}
                className="p-2 rounded-lg bg-[var(--color-card-bg)] border border-[var(--color-border)] text-[var(--color-primary-text)]"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="font-bold text-[var(--color-primary-text)]">DhanLabh</span>
            </div>
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/screener" element={<Screener />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/stocks/all" element={<AllStocks />} />
              <Route path="/stocks/:symbol" element={<StockDetail />} />
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      ) : (
        <div className="min-h-screen flex items-center justify-center">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      )}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const saved = localStorage.getItem('nepse-dark-mode');
    const isDark = saved !== null ? saved === 'true' : true;
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
