import type { RequestItem, UserType } from '../types/domain';
import type { ChatThread } from '../types/domain';
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

export async function cancelServiceRequest(apiFetch: ApiFetch, requestId: number | string, reason: string) {
  return apiFetch<{ success: boolean; message: string }>(`/api/mobile/cancelar_solicitud/${requestId}`, {
    method: 'POST',
    body: JSON.stringify({ motivo: reason }),
  });
}

export async function updateServiceRequestStatus(apiFetch: ApiFetch, requestId: number | string, status: 'aceptada' | 'rechazada') {
  return apiFetch<{ success: boolean; message: string }>(`/api/mobile/actualizar_estado_solicitud/${requestId}`, {
    method: 'POST',
    body: JSON.stringify({ estado: status }),
  });
}

export async function markServiceRequestDone(apiFetch: ApiFetch, requestId: number | string) {
  return apiFetch<{ success: boolean; message: string }>(`/api/mobile/marcar_concluido/${requestId}`, {
    method: 'POST',
  });
}

export type RequestHistoryEvent = {
  titulo: string;
  detalle: string;
  fecha: string;
};

export async function fetchRequestHistory(apiFetch: ApiFetch, requestId: number | string) {
  const data = await apiFetch<{ success: boolean; historial?: RequestHistoryEvent[] }>(`/api/mobile/historial_solicitud/${requestId}`);
  return data.historial ?? [];
}

export async function fetchRequestMessages(apiFetch: ApiFetch, requestId: number | string) {
  return apiFetch<ChatThread>(`/api/mobile/solicitudes/${requestId}/mensajes`);
}

export async function sendRequestMessage(apiFetch: ApiFetch, requestId: number | string, message: string) {
  return apiFetch<{ success: boolean; message: string; hilo_id: number }>(`/api/mobile/solicitudes/${requestId}/mensajes`, {
    method: 'POST',
    body: JSON.stringify({ mensaje: message }),
  });
}

export async function rateMobileService(
  apiFetch: ApiFetch,
  payload: { requestId: number | string; rating: number; comment: string },
) {
  return apiFetch<{ success: boolean; message: string }>('/api/mobile/calificar_servicio', {
    method: 'POST',
    body: JSON.stringify({
      solicitud_id: payload.requestId,
      calificacion: payload.rating,
      comentario: payload.comment,
    }),
  });
}
