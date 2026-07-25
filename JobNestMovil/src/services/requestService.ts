import type { RequestItem, UserType } from '../types/domain';
import type { ApiOptions } from './api';

type ApiFetch = <T>(path: string, options?: ApiOptions) => Promise<T>;

export async function fetchRequests(apiFetch: ApiFetch, role: UserType) {
  const endpoint = role === 'Prestador' ? '/api/mobile/mis_solicitudes_prestador' : '/api/mobile/mis_solicitudes_cliente';
  const data = await apiFetch<RequestItem[] | { solicitudes?: RequestItem[]; data?: RequestItem[] }>(endpoint);
  return Array.isArray(data) ? data : data?.solicitudes ?? data?.data ?? [];
}

export async function sendServiceRequest(
  apiFetch: ApiFetch,
  payload: {
    publicationId: number | string;
    serviceDate: string;
    serviceTime: string;
    serviceMessage: string;
  },
) {
  const form = new FormData();
  form.append('publicacion_id', String(payload.publicationId));
  form.append('fecha_servicio', payload.serviceDate);
  form.append('hora_servicio', payload.serviceTime);
  form.append('mensaje', payload.serviceMessage);
  await apiFetch('/api/mobile/enviar_solicitud', { method: 'POST', body: form });
}
