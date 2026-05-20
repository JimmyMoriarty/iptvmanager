'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, setAccessToken } from '@/lib/api';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  totpEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, totpCode?: string) => Promise<any>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await authApi.refresh();
      if (data?.accessToken) {
        setAccessToken(data.accessToken);
        const profile = await authApi.profile();
        setUser(profile);
      }
    } catch {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = async (username: string, password: string, totpCode?: string) => {
    const data = await authApi.login({ username, password, totpCode });
    if (data?.accessToken) {
      setAccessToken(data.accessToken);
      const profile = await authApi.profile();
      setUser(profile);
    }
    return data;
  };

  const logout = async () => {
    try { await authApi.logout(); } catch {}
    setAccessToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
