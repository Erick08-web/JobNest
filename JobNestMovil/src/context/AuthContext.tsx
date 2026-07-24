import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ApiOptions } from '../services/api';
import { apiRequest, getDefaultApiUrl } from '../services/api';
import type { SessionUser, UserType } from '../types/domain';
import { normalizeUserType } from '../utils/formatters';

type AuthContextValue = {
  apiUrl: string;
  setApiUrl: (value: string) => void;
  sessionCookie: string;
  user: SessionUser | null;
  currentUserType: UserType;
  isLoggedIn: boolean;
  loading: boolean;
  setLoading: (value: boolean) => void;
  apiMessage: string;
  setApiMessage: (value: string) => void;
  apiFetch: <T>(path: string, options?: ApiOptions) => Promise<T>;
  setUser: (user: SessionUser | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const DEFAULT_API_URL = getDefaultApiUrl();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [sessionCookie, setSessionCookie] = useState('');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiMessage, setApiMessage] = useState('');

  const apiFetch = useCallback(
    <T,>(path: string, options: ApiOptions = {}) => apiRequest<T>(apiUrl, sessionCookie, path, options, setSessionCookie),
    [apiUrl, sessionCookie],
  );

  const logout = useCallback(() => {
    setUser(null);
    setSessionCookie('');
    setApiMessage('');
  }, []);

  const value = useMemo(
    () => ({
      apiUrl,
      setApiUrl,
      sessionCookie,
      user,
      currentUserType: normalizeUserType(user?.tipo_usuario),
      isLoggedIn: Boolean(user),
      loading,
      setLoading,
      apiMessage,
      setApiMessage,
      apiFetch,
      setUser,
      logout,
    }),
    [apiFetch, apiMessage, apiUrl, loading, logout, sessionCookie, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}
