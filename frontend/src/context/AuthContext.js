import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const data = await authService.login(email, password);
      const userData = {
        id: data.id,
        email: data.email,
        name: data.nombre || data.email?.split('@')[0] || 'Usuario',
        role: data.role || 'USER',
        token: data.token,
      };
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const register = useCallback(async (data) => {
    setError(null);
    try {
      const result = await authService.register(data);
      if (result.token) {
        const userData = {
          id: result.id,
          email: result.email,
          name: result.nombre || result.email?.split('@')[0] || 'Usuario',
          role: result.role || 'USER',
          token: result.token,
        };
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        return userData;
      }
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setError(null);
  }, []);

  const isAdmin = user?.role === 'ADMIN';

  const value = {
    user,
    loading,
    error,
    isAdmin,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    setError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}

export default AuthContext;
