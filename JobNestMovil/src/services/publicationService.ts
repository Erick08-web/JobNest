import type { Publication } from '../types/domain';
import type { ApiOptions } from './api';

type ApiFetch = <T>(path: string, options?: ApiOptions) => Promise<T>;

export type PublicationImageAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export async function fetchPublications(apiFetch: ApiFetch) {
  const data = await apiFetch<Publication[] | { publicaciones?: Publication[]; data?: Publication[] }>('/api/mobile/publicaciones_activas', {
    auth: false,
  });
  return Array.isArray(data) ? data : data?.publicaciones ?? data?.data ?? [];
}

export async function createPublication(
  apiFetch: ApiFetch,
  payload: {
    postTitle: string;
    postDescription: string;
    postCategory: string;
    postPrice: string;
    postLocation: string;
    postSkills: string;
    postExperience: string;
    postAvailability: string;
    postPriceType: string;
    images?: PublicationImageAsset[];
  },
) {
  const form = new FormData();
  form.append('titulo', payload.postTitle);
  form.append('descripcion', payload.postDescription);
  form.append('categoria', payload.postCategory);
  form.append('salario', payload.postPrice);
  form.append('ubicacion', payload.postLocation);
  if (payload.postExperience) form.append('experiencia', payload.postExperience);
  form.append('habilidades', payload.postSkills);
  if (payload.postAvailability) form.append('disponibilidad', payload.postAvailability);
  if (payload.postPriceType) form.append('tipo_precio', payload.postPriceType);
  payload.images?.forEach((image, index) => {
    const name = image.fileName || `servicio-${Date.now()}-${index}.jpg`;
    const type = image.mimeType || 'image/jpeg';
    form.append('imagenes', { uri: image.uri, name, type } as unknown as Blob);
  });
  await apiFetch('/api/mobile/crear_publicacion', { method: 'POST', body: form });
}
