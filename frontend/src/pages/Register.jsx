import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register, login } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { UserPlus, TrendingUp } from 'lucide-react';

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '', password2: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      const res = await login({ username: form.username, password: form.password });
      await loginUser(res.data);
      navigate('/dashboard');
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msg = Object.values(data).flat().join(', ');
        setError(msg);
      } else {
        setError('Registration failed');
      }
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
          <h2 className="text-[22px] font-bold text-[var(--color-primary-text)]">Create Account</h2>
          <p className="text-[var(--color-secondary-text)] mt-2">Start tracking NEPSE stocks today</p>
        </div>

        {error && (
          <div className="bg-[var(--color-loss-tint)] border border-[var(--color-loss)]/30 text-[var(--color-loss)] rounded-lg p-4 mb-6 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-secondary-text)] mb-2">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="input"
              placeholder="Choose a username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-secondary-text)] mb-2">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              placeholder="Enter your email"
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
              placeholder="Create a password"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-secondary-text)] mb-2">Confirm Password</label>
            <input
              type="password"
              value={form.password2}
              onChange={(e) => setForm({ ...form, password2: e.target.value })}
              className="input"
              placeholder="Confirm your password"
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
                Creating account...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <UserPlus className="h-4 w-4" />
                Create Account
              </span>
            )}
          </button>
        </form>

        <p className="text-[var(--color-secondary-text)] text-sm mt-6 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--color-brand)] hover:underline font-medium no-underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
