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

const buildLoginPayload = (identifier, password) => {
  const trimmedIdentifier = identifier.trim();
  const identifierKey = trimmedIdentifier.includes('@') ? 'email' : 'phone_number';

  return {
    [identifierKey]: trimmedIdentifier,
    password,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(parseStoredUser());
    setLoading(false);
  }, []);

  const login = async (identifier, password) => {
    const res = await api.post('/users/login', buildLoginPayload(identifier, password));
    const { success, token, user: loggedInUser, message } = res.data || {};

    if (!success || !token || !loggedInUser) {
      throw new Error(message || 'Login failed');
    }

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);

    return loggedInUser;
  };

  const register = async (userData) => {
    const payload = {
      full_name: userData.full_name?.trim() || null,
      email: userData.email?.trim() || null,
      phone_number: userData.phone_number?.trim() || null,
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
    window.location.href = '/login';
  };

  const value = useMemo(
    () => ({
      user,
      login,
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
