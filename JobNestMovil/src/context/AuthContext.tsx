import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ApiOptions } from '../services/api';
import { apiRequest, getDefaultApiUrl, normalizeApiBaseUrl } from '../services/api';
import { fetchCurrentUser, login as loginRequest, logout as logoutRequest } from '../services/authService';
import { clearTokens, getStoredApiUrl, getStoredTokens, saveApiUrl, saveTokens, type StoredTokens } from '../services/tokenStorage';
import type { SessionUser, UserType } from '../types/domain';
import { normalizeUserType } from '../utils/formatters';

type AuthContextValue = {
  apiUrl: string;
  setApiUrl: (value: string) => void;
  tokens: StoredTokens | null;
  user: SessionUser | null;
  currentUserType: UserType;
  isLoggedIn: boolean;
  isRestoring: boolean;
  loading: boolean;
  setLoading: (value: boolean) => void;
  apiMessage: string;
  setApiMessage: (value: string) => void;
  apiFetch: <T>(path: string, options?: ApiOptions) => Promise<T>;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const DEFAULT_API_URL = getDefaultApiUrl();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [loading, setLoading] = useState(false);
  const [apiMessage, setApiMessage] = useState('');

  const updateApiUrl = useCallback((value: string) => {
    const normalized = normalizeApiBaseUrl(value);
    setApiUrl(normalized);
    void saveApiUrl(normalized);
  }, []);

  const apiFetch = useCallback(
    <T,>(path: string, options: ApiOptions = {}) =>
      apiRequest<T>(apiUrl, path, options, {
        onTokens: setTokens,
        onUnauthorized: () => {
          setTokens(null);
          setUser(null);
        },
      }),
    [apiUrl],
  );

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      setIsRestoring(true);
      try {
        const storedApiUrl = await getStoredApiUrl();
        const nextApiUrl = normalizeApiBaseUrl(storedApiUrl || DEFAULT_API_URL);
        if (!mounted) return;
        setApiUrl(nextApiUrl);
        if (storedApiUrl !== nextApiUrl) {
          await saveApiUrl(nextApiUrl);
        }

        const storedTokens = await getStoredTokens();
        if (!mounted) return;
        if (!storedTokens) {
          setTokens(null);
          setUser(null);
          return;
        }

        setTokens(storedTokens);
        const currentUser = await fetchCurrentUser(apiFetch);
        if (!mounted) return;
        setUser(currentUser);
      } catch {
        await clearTokens();
        if (!mounted) return;
        setTokens(null);
        setUser(null);
      } finally {
        if (mounted) setIsRestoring(false);
      }
    }

    void restoreSession();
    return () => {
      mounted = false;
    };
  }, [apiFetch]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setApiMessage('');
    try {
      const response = await loginRequest(apiFetch, email, password);
      const nextTokens = {
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
      };
      await saveTokens(nextTokens);
      setTokens(nextTokens);
      setUser(response.user);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const refreshUser = useCallback(async () => {
    const currentUser = await fetchCurrentUser(apiFetch);
    setUser(currentUser);
  }, [apiFetch]);

  const logout = useCallback(async () => {
    const storedTokens = tokens ?? await getStoredTokens();
    try {
      await logoutRequest(apiFetch, storedTokens);
    } catch {
      // El cierre local debe completarse aunque no haya conexión con Flask.
    }
    await clearTokens();
    setTokens(null);
    setUser(null);
    setApiMessage('');
  }, [apiFetch, tokens]);

  const value = useMemo(
    () => ({
      apiUrl,
      setApiUrl: updateApiUrl,
      tokens,
      user,
      currentUserType: normalizeUserType(user?.tipo_usuario),
      isLoggedIn: Boolean(user),
      isRestoring,
      loading,
      setLoading,
      apiMessage,
      setApiMessage,
      apiFetch,
      refreshUser,
      login,
      logout,
    }),
    [apiFetch, apiMessage, apiUrl, isRestoring, loading, login, logout, refreshUser, tokens, updateApiUrl, user],
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
