import type { Publication, RequestItem, UserType } from '../types/domain';
import { normalizeApiBaseUrl, normalizeApiPath } from '../services/api';

export function normalizePublication(item: Publication): Publication {
  return {
    ...item,
    id: item.id ?? item.Id ?? item.PublicacionId,
    titulo: item.titulo ?? item.Titulo ?? 'Servicio profesional',
    descripcion: item.descripcion ?? item.Descripcion ?? 'Servicio disponible en JobNest.',
    categoria: item.categoria ?? item.Categoria ?? 'Servicio',
    ubicacion: item.ubicacion ?? item.Ubicacion ?? 'Ubicacion no especificada',
    salario: item.salario ?? item.Salario ?? item.precio,
    precio: item.precio ?? item.salario ?? item.Salario,
    precio_texto: item.precio_texto,
    tipo_precio: item.tipo_precio,
    fecha_creacion: item.fecha_creacion,
    incluye_materiales: item.incluye_materiales,
    disponibilidad: item.disponibilidad ?? item.Disponibilidad,
    nombre_prestador: item.nombre_prestador ?? item.NombrePrestador ?? item.prestador_nombre,
    prestador_email: item.prestador_email,
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
  return item.titulo ?? item.Titulo ?? item.servicio ?? item.Servicio ?? item.publicacion_titulo ?? item.PublicacionTitulo ?? 'Solicitud de servicio';
}

export function getRequestStatus(item: RequestItem) {
  return item.estado ?? item.Estado ?? 'Pendiente';
}

export function getRequestDate(item: RequestItem) {
  return item.fecha_servicio ?? item.FechaServicio ?? 'Fecha por confirmar';
}

export function getRequestPerson(item: RequestItem, viewer: UserType) {
  if (viewer === 'Prestador') {
    return item.cliente_nombre ?? item.ClienteNombre ?? item.cliente ?? 'Cliente JobNest';
  }
  return item.prestador_nombre ?? item.PrestadorNombre ?? item.prestador ?? 'Profesional JobNest';
}

export function money(value?: number | string) {
  if (value === undefined || value === null || value === '') return '';
  const number = Number(value);
  if (Number.isFinite(number)) return `$${number.toLocaleString('es-MX')}`;
  return String(value);
}

export function formatServicePrice(item: Publication) {
  if (item.precio_texto) return item.precio_texto;
  const value = item.precio ?? item.salario ?? item.Salario;
  if (value === undefined || value === null || value === '') return '';
  const amount = money(value);
  if (!amount) return '';
  const mode = item.tipo_precio;
  const suffix: Record<string, string> = {
    hora: ' por hora',
    servicio: ' por servicio',
    dia: ' por día',
    proyecto: ' por proyecto',
  };
  return `${amount}${mode ? suffix[mode] ?? ` ${mode}` : ''}`;
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
  const normalizedBase = normalizeApiBaseUrl(apiUrl);
  const normalizedPath = normalizeApiPath(value);
  return `${normalizedBase}${normalizedPath}`;
}
