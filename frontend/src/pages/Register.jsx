import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register, login } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { UserPlus, TrendingUp } from 'lucide-react';

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '', password2: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const validateForm = () => {
    const errors = {};
    
    if (!form.username.trim()) {
      errors.username = 'Username is required';
    } else if (form.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }
    
    if (!form.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      errors.email = 'Email is invalid';
    }
    
    if (!form.password) {
      errors.password = 'Password is required';
    } else if (form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) {
      errors.password = 'Password must contain uppercase, lowercase, and number';
    }
    
    if (!form.password2) {
      errors.password2 = 'Please confirm your password';
    } else if (form.password !== form.password2) {
      errors.password2 = 'Passwords do not match';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    try {
      await register(form);
      const res = await login({ username: form.username, password: form.password });
      await loginUser(res.data);
      navigate('/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      const data = err.response?.data;
      let errorMessage = 'Registration failed. Please try again.';
      
      if (data) {
        // Handle Django validation errors
        if (typeof data === 'object') {
          const errors = [];
          if (data.username) errors.push(`Username: ${data.username.join(', ')}`);
          if (data.email) errors.push(`Email: ${data.email.join(', ')}`);
          if (data.password) errors.push(`Password: ${data.password.join(', ')}`);
          if (data.non_field_errors) errors.push(data.non_field_errors.join(', '));
          if (data.detail) errors.push(data.detail);
          
          errorMessage = errors.length > 0 ? errors.join(', ') : 'Validation failed';
        } else if (typeof data === 'string') {
          errorMessage = data;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
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
              className={`input ${fieldErrors.username ? 'border-[var(--color-loss)]' : ''}`}
              placeholder="Choose a username"
              required
            />
            {fieldErrors.username && (
              <p className="text-[var(--color-loss)] text-xs mt-1">{fieldErrors.username}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-secondary-text)] mb-2">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={`input ${fieldErrors.email ? 'border-[var(--color-loss)]' : ''}`}
              placeholder="Enter your email"
              required
            />
            {fieldErrors.email && (
              <p className="text-[var(--color-loss)] text-xs mt-1">{fieldErrors.email}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-secondary-text)] mb-2">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={`input ${fieldErrors.password ? 'border-[var(--color-loss)]' : ''}`}
              placeholder="Create a password (min 8 chars, uppercase, lowercase, number)"
              required
            />
            {fieldErrors.password && (
              <p className="text-[var(--color-loss)] text-xs mt-1">{fieldErrors.password}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-secondary-text)] mb-2">Confirm Password</label>
            <input
              type="password"
              value={form.password2}
              onChange={(e) => setForm({ ...form, password2: e.target.value })}
              className={`input ${fieldErrors.password2 ? 'border-[var(--color-loss)]' : ''}`}
              placeholder="Confirm your password"
              required
            />
            {fieldErrors.password2 && (
              <p className="text-[var(--color-loss)] text-xs mt-1">{fieldErrors.password2}</p>
            )}
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
