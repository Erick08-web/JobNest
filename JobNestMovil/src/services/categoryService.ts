import type { Category } from '../types/domain';
import type { ApiOptions } from './api';

type ApiFetch = <T>(path: string, options?: ApiOptions) => Promise<T>;

export async function fetchCategories(apiFetch: ApiFetch) {
  const data = await apiFetch<{ success?: boolean; categorias?: string[]; data?: string[] }>('/api/mobile/categorias', {
    auth: false,
  });
  const list = data.categorias ?? data.data ?? [];
  return list.filter(Boolean).map<Category>((nombre) => ({ nombre }));
}
