import type { SessionUser, UserType } from '../types/domain';
import { userTypeForApi } from '../utils/formatters';
import type { ApiOptions } from './api';

type ApiFetch = <T>(path: string, options?: ApiOptions) => Promise<T>;

export async function login(apiFetch: ApiFetch, email: string, password: string) {
  const form = new FormData();
  form.append('email', email);
  form.append('password', password);
  await apiFetch('/login', { method: 'POST', body: form });
}

export async function fetchCurrentUser(apiFetch: ApiFetch) {
  const data = await apiFetch<{ user?: SessionUser } & SessionUser>('/get_user_data');
  return data?.user ?? data ?? {};
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
  },
) {
  await apiFetch('/registrar_usuario_web', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: payload.firstName,
      lastNameP: payload.lastNameP,
      lastNameM: payload.lastNameM,
      candidatePhone: payload.phone,
      email: payload.registerEmail,
      password: payload.registerPassword,
      confirmPassword: payload.registerPassword,
      userType: userTypeForApi(payload.registerType),
      termsCheck: 'on',
    }),
  });
}
