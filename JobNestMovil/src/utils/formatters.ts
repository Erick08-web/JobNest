import type { Publication, RequestItem, UserType } from '../types/domain';

export function normalizePublication(item: Publication): Publication {
  return {
    ...item,
    id: item.id ?? item.Id ?? item.PublicacionId,
    titulo: item.titulo ?? item.Titulo ?? 'Servicio profesional',
    descripcion: item.descripcion ?? item.Descripcion ?? 'Servicio disponible en JobNest.',
    categoria: item.categoria ?? item.Categoria ?? 'Servicio',
    ubicacion: item.ubicacion ?? item.Ubicacion ?? 'Ubicacion no especificada',
    salario: item.salario ?? item.Salario ?? item.precio ?? 'A convenir',
    disponibilidad: item.disponibilidad ?? item.Disponibilidad ?? 'Consultar disponibilidad',
    nombre_prestador: item.nombre_prestador ?? item.NombrePrestador ?? 'Profesional JobNest',
    promedio_calificacion: item.promedio_calificacion ?? item.calificacion ?? 'Nuevo',
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
  if (value === undefined || value === null || value === '') return 'A convenir';
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
