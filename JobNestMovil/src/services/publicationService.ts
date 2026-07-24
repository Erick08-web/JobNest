import type { Publication } from '../types/domain';
import type { ApiOptions } from './api';

type ApiFetch = <T>(path: string, options?: ApiOptions) => Promise<T>;

export async function fetchPublications(apiFetch: ApiFetch) {
  const data = await apiFetch<Publication[] | { publicaciones?: Publication[]; data?: Publication[] }>('/publicaciones_activas');
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
  },
) {
  const form = new FormData();
  form.append('titulo', payload.postTitle);
  form.append('descripcion', payload.postDescription);
  form.append('categoria', payload.postCategory);
  form.append('salario', payload.postPrice);
  form.append('ubicacion', payload.postLocation);
  form.append('experiencia', '1');
  form.append('habilidades', payload.postSkills);
  form.append('disponibilidad', 'Disponible esta semana');
  form.append('tipo_precio', 'hora');
  await apiFetch('/crear_publicacion', { method: 'POST', body: form });
}
