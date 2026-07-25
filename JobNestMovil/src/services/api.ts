import { NativeModules } from 'react-native';
import { clearTokens, getStoredTokens, saveTokens, type StoredTokens } from './tokenStorage';

export type ApiOptions = RequestInit & {
  skipJson?: boolean;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
};

type ApiHandlers = {
  onTokens?: (tokens: StoredTokens) => void;
  onUnauthorized?: () => void;
};

type ParsedResponse<T> = {
  response: Response;
  data: T;
};

let refreshPromise: Promise<StoredTokens> | null = null;

export class ApiError extends Error {
  status: number;
  errors: Record<string, string>;

  constructor(message: string, status: number, errors: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

export function getDefaultApiUrl() {
  const scriptUrl = NativeModules.SourceCode?.scriptURL;

  if (typeof scriptUrl === 'string') {
    try {
      const { hostname } = new URL(scriptUrl);

      if (hostname) {
        return `http://${hostname}:5001`;
      }
    } catch {
      const host = scriptUrl.match(/\/\/([^/:]+)/)?.[1];

      if (host) {
        return `http://${host}:5001`;
      }
    }
  }

  return 'http://localhost:5001';
}

export async function apiRequest<T>(
  apiUrl: string,
  path: string,
  options: ApiOptions = {},
  handlers: ApiHandlers = {},
) {
  return requestWithJwt<T>(apiUrl, path, options, handlers, true);
}

async function requestWithJwt<T>(
  apiUrl: string,
  path: string,
  options: ApiOptions,
  handlers: ApiHandlers,
  allowRefresh: boolean,
) {
  const normalizedBase = apiUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const shouldUseAuth = options.auth !== false;
  const tokens = shouldUseAuth ? await getStoredTokens() : null;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (shouldUseAuth && tokens?.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  const response = await fetch(`${normalizedBase}${normalizedPath}`, {
    ...options,
    headers,
  });

  const parsed = await parseResponse<T>(response, options);

  if (
    response.status === 401 &&
    shouldUseAuth &&
    allowRefresh &&
    options.retryOnUnauthorized !== false
  ) {
    try {
      await refreshTokens(apiUrl, handlers);
      return requestWithJwt<T>(apiUrl, path, options, handlers, false);
    } catch {
      await clearTokens();
      handlers.onUnauthorized?.();
      throw new Error('Sesión expirada. Inicia sesión nuevamente.');
    }
  }

  if (!response.ok) {
    const errorData = parsed.data as { message?: string; error?: string; errors?: Record<string, string> };
    throw new ApiError(errorData?.message || errorData?.error || `Error ${response.status}`, response.status, errorData?.errors ?? {});
  }

  return parsed.data;
}

async function parseResponse<T>(response: Response, options: ApiOptions): Promise<ParsedResponse<T>> {
  if (options.skipJson) return { response, data: null as T };

  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  return { response, data: data as T };
}

async function refreshTokens(apiUrl: string, handlers: ApiHandlers) {
  if (!refreshPromise) {
    refreshPromise = performRefresh(apiUrl, handlers).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function performRefresh(apiUrl: string, handlers: ApiHandlers) {
  const tokens = await getStoredTokens();
  if (!tokens?.refreshToken) {
    throw new Error('No hay refresh token disponible.');
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/mobile/auth/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${tokens.refreshToken}`,
    },
  });
  const parsed = await parseResponse<{
    access_token?: string;
    refresh_token?: string;
    message?: string;
  }>(response, {});

  if (!response.ok || !parsed.data.access_token || !parsed.data.refresh_token) {
    throw new Error(parsed.data.message || 'No fue posible renovar la sesión.');
  }

  const nextTokens = {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
  };
  await saveTokens(nextTokens);
  handlers.onTokens?.(nextTokens);
  return nextTokens;
}
