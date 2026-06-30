import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Briefcase,
  Star,
  Search,
  MessageSquare,
  LogOut,
  X,
  TrendingUp
} from 'lucide-react';

export default function Sidebar({ mobileOpen, onCloseMobile }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/portfolio', icon: Briefcase, label: 'Portfolio' },
    { path: '/watchlist', icon: Star, label: 'Watchlist' },
    { path: '/screener', icon: Search, label: 'Screener' },
    { path: '/chat', icon: MessageSquare, label: 'AI Chat' },
  ];

  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      {/* Logo */}
      <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <div className="bg-[var(--color-brand)] p-2 rounded-lg">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-[var(--color-primary-text)]">Dhan</span>
            <span className="text-[var(--color-brand)] font-bold ml-1">Labh</span>
          </div>
        </Link>
        <button onClick={onCloseMobile} className="md:hidden text-[var(--color-secondary-text)] hover:text-[var(--color-primary-text)] bg-transparent border-0 p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
                           (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onCloseMobile}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-3 px-2">
          <div className="h-8 w-8 rounded-full bg-[var(--color-brand-tint)] flex items-center justify-center text-[var(--color-brand)] text-xs font-bold">
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-primary-text)] truncate">{user?.username || 'User'}</p>
            <p className="text-xs text-[var(--color-secondary-text)] truncate">{user?.email || ''}</p>
          </div>
          <button onClick={logout} className="text-[var(--color-secondary-text)] hover:text-[var(--color-loss)] bg-transparent border-0 p-1" title="Logout">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
