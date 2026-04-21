import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TrendingUp, LogOut, LayoutDashboard, Briefcase } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="glass-card border-b border-gray-800/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-xl font-bold text-white no-underline group">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-1.5 rounded-lg shadow-lg shadow-emerald-900/20 group-hover:shadow-emerald-900/30 transition-shadow">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <span>Ontreat<span className="text-emerald-400 ml-1">NEPSE</span></span>
        </Link>

        <div className="flex items-center gap-1">
          {user ? (
            <>
              <Link 
                to="/dashboard" 
                className="btn-ghost flex items-center gap-1.5 text-sm"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <Link 
                to="/portfolio" 
                className="btn-ghost flex items-center gap-1.5 text-sm"
              >
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">Portfolio</span>
              </Link>
              <div className="w-px h-6 bg-gray-800 mx-2" />
              <div className="flex items-center gap-2 text-sm">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                  {user.username[0].toUpperCase()}
                </div>
                <span className="text-gray-300 hidden md:inline">{user.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="btn-ghost flex items-center gap-1.5 text-sm hover:text-red-400 hover:bg-red-500/10"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link 
                to="/login" 
                className="btn-ghost text-sm"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="btn-primary text-sm"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
