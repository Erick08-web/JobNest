import type { Publication, RequestItem, UserType } from '../types/domain';

export function normalizePublication(item: Publication): Publication {
  return {
    ...item,
    id: item.id ?? item.Id ?? item.PublicacionId,
    titulo: item.titulo ?? item.Titulo ?? 'Servicio profesional',
    descripcion: item.descripcion ?? item.Descripcion ?? 'Servicio disponible en JobNest.',
    categoria: item.categoria ?? item.Categoria ?? 'Servicio',
    ubicacion: item.ubicacion ?? item.Ubicacion ?? 'Ubicacion no especificada',
    salario: item.salario ?? item.Salario ?? item.precio,
    disponibilidad: item.disponibilidad ?? item.Disponibilidad,
    nombre_prestador: item.nombre_prestador ?? item.NombrePrestador ?? item.prestador_nombre,
    promedio_calificacion: item.promedio_calificacion ?? item.calificacion,
  };
}

export function getPublicationId(item: Publication) {
  return item.id ?? item.Id ?? item.PublicacionId;
}

export function getTitle(item: Publication) {
  return item.titulo ?? item.Titulo ?? 'Servicio profesional';
}

export function getRequestTitle(item: RequestItem) {
  return item.titulo ?? item.Titulo ?? 'Solicitud de servicio';
}

export function getRequestStatus(item: RequestItem) {
  return item.estado ?? item.Estado ?? 'Pendiente';
}

export function money(value?: number | string) {
  if (value === undefined || value === null || value === '') return '';
  const number = Number(value);
  if (Number.isFinite(number)) return `$${number.toLocaleString('es-MX')}`;
  return String(value);
}

export function normalizeUserType(value?: string): UserType {
  return value?.toLowerCase() === 'prestador' ? 'Prestador' : 'Cliente';
}

export function userTypeForApi(value: UserType) {
  return value === 'Prestador' ? 'prestador' : 'cliente';
}

export function buildAbsoluteUrl(apiUrl: string, value?: string | null) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const normalizedBase = apiUrl.replace(/\/$/, '');
  const normalizedPath = value.startsWith('/') ? value : `/${value}`;
  return `${normalizedBase}${normalizedPath}`;
}
