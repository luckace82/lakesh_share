import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login } from '../api/client';
import { LogIn, TrendingUp } from 'lucide-react';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(form);
      await loginUser(res.data);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          'Login failed. Please check your credentials.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="bg-[var(--color-brand)] p-2 rounded-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-[var(--color-primary-text)]">Ontreat <span className="text-[var(--color-brand)]">NEPSE</span></span>
          </div>
          <h2 className="text-[22px] font-bold text-[var(--color-primary-text)]">Welcome Back</h2>
          <p className="text-[var(--color-secondary-text)] mt-2">Sign in to your account to continue</p>
        </div>

        {error && (
          <div className="bg-[var(--color-loss-tint)] border border-[var(--color-loss)]/30 text-[var(--color-loss)] rounded-lg p-4 mb-6 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--color-secondary-text)] mb-2">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="input"
              placeholder="Enter your username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-secondary-text)] mb-2">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input"
              placeholder="Enter your password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-base"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="spinner h-4 w-4" />
                Signing in...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <LogIn className="h-4 w-4" />
                Sign In
              </span>
            )}
          </button>
        </form>

        <p className="text-[var(--color-secondary-text)] text-sm mt-6 text-center">
          Don't have an account?{' '}
          <Link to="/register" className="text-[var(--color-brand)] hover:underline font-medium no-underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
