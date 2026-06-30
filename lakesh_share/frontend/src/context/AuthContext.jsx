import { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (token) {
        try {
          const res = await getMe();
          setUser(res.data);
          setError(null);
        } catch (err) {
          console.error('Auth initialization error:', err);
          if (err.response?.status === 401 || err.response?.status === 403) {
            // Clear invalid tokens
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            setError('Session expired. Please login again.');
          } else {
            setError('Authentication error. Please try again.');
          }
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const loginUser = async (tokens) => {
    try {
      // Store tokens first
      localStorage.setItem('access_token', tokens.access);
      localStorage.setItem('refresh_token', tokens.refresh);
      
      // Get user data
      const res = await getMe();
      setUser(res.data);
      setError(null);
      return res.data;
    } catch (err) {
      console.error('Login error:', err);
      // Clear tokens on error
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      setError('Failed to get user data. Please login again.');
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setError(null);
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, loginUser, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
