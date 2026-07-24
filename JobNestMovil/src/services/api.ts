import { NativeModules } from 'react-native';

export type ApiOptions = RequestInit & { skipJson?: boolean };

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
  sessionCookie: string,
  path: string,
  options: ApiOptions = {},
  onCookie?: (cookie: string) => void,
) {
  const normalizedBase = apiUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (sessionCookie) headers.Cookie = sessionCookie;

  const response = await fetch(`${normalizedBase}${normalizedPath}`, {
    ...options,
    headers,
  });

  const cookie = response.headers.get('set-cookie');
  if (cookie) onCookie?.(cookie.split(';')[0]);

  if (options.skipJson) return null as T;

  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const errorData = data as { message?: string; error?: string };
    throw new Error(errorData?.message || errorData?.error || `Error ${response.status}`);
  }

  return data as T;
}
