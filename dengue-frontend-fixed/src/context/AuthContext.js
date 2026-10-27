import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../axios';

const AuthContext = createContext(null);

const parseStoredUser = () => {
  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');

  if (!token || !storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch (error) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(parseStoredUser());
    setLoading(false);

    // Keep React state in sync when the API interceptor detects an expired token.
    const handleSessionExpired = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    };

    // Sync account changes made in another browser tab.
    const handleStorage = (event) => {
      if (event.key === 'token' || event.key === 'user') {
        setUser(parseStoredUser());
      }
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const login = async (email, password) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const res = await api.post('/users/login', { email: normalizedEmail, password });
    const { success, token, user: loggedInUser, message } = res.data || {};

    if (!success || !token || !loggedInUser) {
      throw new Error(message || 'Login failed');
    }

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);

    return loggedInUser;
  };

  const googleSignIn = async (credential) => {
    const res = await api.post('/users/google-auth', { credential });
    const { success, token, user: loggedInUser, message } = res.data || {};

    if (!success || !token || !loggedInUser) {
      throw new Error(message || 'Google sign-in failed');
    }

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return loggedInUser;
  };

  const register = async (userData) => {
    const payload = {
      full_name: userData.full_name?.trim() || null,
      email: userData.email?.trim().toLowerCase() || null,
      role: userData.role,
      password: userData.password,
    };

    const res = await api.post('/users/register', payload);
    const { success, message } = res.data || {};

    if (!success) {
      throw new Error(message || 'Registration failed');
    }

    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.replace('/');
  };

  const value = useMemo(
    () => ({
      user,
      login,
      googleSignIn,
      logout,
      register,
      loading,
      isAuthenticated: Boolean(user),
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
