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

const GENERIC_ACTION_ERROR = 'No pudimos completar la acción. Inténtalo nuevamente.';
const GENERIC_CONNECTION_ERROR = 'No fue posible conectarnos en este momento. Inténtalo nuevamente.';
const API_BACKEND_PREFIX = '/api/backend';
export const OFFICIAL_API_URL = 'https://jobnestservices.com/api/backend';
const TECHNICAL_ERROR_PATTERNS = [
  /network request failed/i,
  /failed to fetch/i,
  /error\s*500/i,
  /api error/i,
  /database error/i,
  /backend unavailable/i,
  /backend/i,
  /endpoint/i,
  /base de datos/i,
  /database/i,
  /servidor/i,
];

const UNSAFE_HOSTS = new Set(['localhost', '127.0.0.1', '159.54.154.70']);
const UNSAFE_PORTS = new Set(['5000', '5001']);

export function getUserSafeMessage(message: unknown, fallback = GENERIC_ACTION_ERROR) {
  if (typeof message !== 'string' || !message.trim()) return fallback;
  return TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message)) ? fallback : message;
}

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

function isPrivateIp(hostname: string) {
  return (
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

export function normalizeApiBaseUrl(value?: string | null) {
  const candidate = (value || '').trim().replace(/\/+$/, '');
  if (!candidate) return OFFICIAL_API_URL;

  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    const isUnsafe =
      parsed.protocol !== 'https:' ||
      UNSAFE_HOSTS.has(hostname) ||
      isPrivateIp(hostname) ||
      UNSAFE_PORTS.has(parsed.port);

    if (isUnsafe) return OFFICIAL_API_URL;

    const normalizedPath = parsed.pathname.replace(/\/+$/, '');
    const basePath = normalizedPath.endsWith(API_BACKEND_PREFIX)
      ? normalizedPath
      : `${normalizedPath}${API_BACKEND_PREFIX}`;
    parsed.pathname = basePath.replace(/\/api\/backend\/api\/backend/g, API_BACKEND_PREFIX);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return OFFICIAL_API_URL;
  }
}

export function getDefaultApiUrl() {
  return normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
}

export function normalizeApiPath(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedPath === API_BACKEND_PREFIX) return '';
  if (normalizedPath.startsWith(`${API_BACKEND_PREFIX}/`)) {
    return normalizedPath.slice(API_BACKEND_PREFIX.length);
  }
  return normalizedPath;
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
  const normalizedBase = normalizeApiBaseUrl(apiUrl);
  const normalizedPath = normalizeApiPath(path);
  const shouldUseAuth = options.auth !== false;
  const tokens = shouldUseAuth ? await getStoredTokens() : null;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (shouldUseAuth && tokens?.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  let response: Response;

  try {
    response = await fetch(`${normalizedBase}${normalizedPath}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(GENERIC_CONNECTION_ERROR);
  }

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
    throw new ApiError(getUserSafeMessage(errorData?.message || errorData?.error), response.status, errorData?.errors ?? {});
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

  let response: Response;

  try {
    response = await fetch(`${normalizeApiBaseUrl(apiUrl)}/api/mobile/auth/refresh`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${tokens.refreshToken}`,
      },
    });
  } catch {
    throw new Error(GENERIC_CONNECTION_ERROR);
  }
  const parsed = await parseResponse<{
    access_token?: string;
    refresh_token?: string;
    message?: string;
  }>(response, {});

  if (!response.ok || !parsed.data.access_token || !parsed.data.refresh_token) {
    throw new Error(getUserSafeMessage(parsed.data.message, 'No fue posible renovar la sesión.'));
  }

  const nextTokens = {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
  };
  await saveTokens(nextTokens);
  handlers.onTokens?.(nextTokens);
  return nextTokens;
}
