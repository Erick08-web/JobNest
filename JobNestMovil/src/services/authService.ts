import type { SessionUser, UserType } from '../types/domain';
import { userTypeForApi } from '../utils/formatters';
import type { ApiOptions } from './api';
import type { StoredTokens } from './tokenStorage';

type ApiFetch = <T>(path: string, options?: ApiOptions) => Promise<T>;

export type MobileAuthResponse = {
  success: boolean;
  token_type: 'Bearer';
  access_token: string;
  refresh_token: string;
  access_expires_in: number;
  refresh_expires_in: number;
  user: SessionUser;
  role: UserType;
};

export async function login(apiFetch: ApiFetch, email: string, password: string) {
  return apiFetch<MobileAuthResponse>('/api/mobile/auth/login', {
    method: 'POST',
    auth: false,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchCurrentUser(apiFetch: ApiFetch) {
  const data = await apiFetch<{ user?: SessionUser } & SessionUser>('/api/mobile/auth/me');
  return data?.user ?? data ?? {};
}

export async function logout(apiFetch: ApiFetch, tokens: StoredTokens | null) {
  await apiFetch('/api/mobile/auth/logout', {
    method: 'POST',
    retryOnUnauthorized: false,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: tokens?.refreshToken ?? '' }),
  });
}

export async function registerUser(
  apiFetch: ApiFetch,
  payload: {
    registerType: UserType;
    firstName: string;
    lastNameP: string;
    lastNameM: string;
    phone: string;
    registerEmail: string;
    registerPassword: string;
    confirmPassword: string;
  },
) {
  await apiFetch('/registrar_usuario_web', {
    method: 'POST',
    auth: false,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: payload.firstName,
      lastNameP: payload.lastNameP,
      lastNameM: payload.lastNameM,
      candidatePhone: payload.phone,
      email: payload.registerEmail,
      password: payload.registerPassword,
      confirmPassword: payload.confirmPassword,
      userType: userTypeForApi(payload.registerType),
      termsCheck: 'on',
    }),
  });
}
