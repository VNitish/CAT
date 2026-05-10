'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthUser, apiFetch, storeAuth, clearAuth, getStoredUser, getToken } from '@/lib/auth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    const token = getToken();
    if (stored && token) {
      setUser(stored);
      // Revalidate token in background
      apiFetch('/api/auth/me')
        .then(r => r.json())
        .then(data => {
          if (data._id) {
            const fresh: AuthUser = { _id: data._id, email: data.email, name: data.name, plan: data.plan };
            setUser(fresh);
            storeAuth(token, fresh);
          } else {
            clearAuth();
            setUser(null);
          }
        })
        .catch(() => { /* keep stored user if network fails */ })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    storeAuth(data.token, data.user);
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, name: string, password: string) => {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, name, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    storeAuth(data.token, data.user);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
