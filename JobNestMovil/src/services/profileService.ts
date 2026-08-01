import type { MobileProfile, PortfolioWork, ProfileReviews } from '../types/domain';
import type { ApiOptions } from './api';

type ApiFetch = <T>(path: string, options?: ApiOptions) => Promise<T>;

export type ProfileUpdatePayload = {
  nombre?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  telefono?: string;
};

export type LocalImageAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export async function fetchMobileProfile(apiFetch: ApiFetch) {
  const data = await apiFetch<{ success: boolean; perfil: MobileProfile }>('/api/mobile/perfil');
  return data.perfil;
}

export async function updateMobileProfile(apiFetch: ApiFetch, payload: ProfileUpdatePayload) {
  const data = await apiFetch<{ success: boolean; message: string; perfil: MobileProfile }>('/api/mobile/perfil', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return data;
}

export async function uploadProfilePhoto(apiFetch: ApiFetch, asset: LocalImageAsset) {
  const form = new FormData();
  const name = asset.fileName || `perfil-${Date.now()}.jpg`;
  const type = asset.mimeType || 'image/jpeg';
  form.append('foto', { uri: asset.uri, name, type } as unknown as Blob);
  const data = await apiFetch<{ success: boolean; message: string; foto_url: string; perfil: MobileProfile }>('/api/mobile/perfil/foto', {
    method: 'POST',
    body: form,
  });
  return data;
}

export async function changeMobilePassword(
  apiFetch: ApiFetch,
  payload: { currentPassword: string; newPassword: string; confirmPassword: string },
) {
  return apiFetch<{ success: boolean; message: string }>('/api/mobile/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current_password: payload.currentPassword,
      new_password: payload.newPassword,
      confirm_password: payload.confirmPassword,
    }),
  });
}

export async function fetchMyPortfolio(apiFetch: ApiFetch) {
  const data = await apiFetch<{ success: boolean; portafolio: PortfolioWork[] }>('/api/mobile/mi-portafolio');
  return data.portafolio ?? [];
}

export async function fetchMyReviews(apiFetch: ApiFetch) {
  const data = await apiFetch<ProfileReviews>('/api/mobile/mi-perfil/resenas');
  return {
    promedio: data.promedio ?? null,
    total: data.total ?? 0,
    resenas: data.resenas ?? [],
  };
}
