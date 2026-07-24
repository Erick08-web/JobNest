export type UserType = 'Cliente' | 'Prestador';

export type SessionUser = {
  id?: number;
  nombre?: string;
  apellido?: string;
  email?: string;
  tipo_usuario?: UserType | string;
  foto_perfil?: string;
};

export type Publication = {
  id?: number;
  Id?: number;
  PublicacionId?: number;
  titulo?: string;
  Titulo?: string;
  descripcion?: string;
  Descripcion?: string;
  categoria?: string;
  Categoria?: string;
  ubicacion?: string;
  Ubicacion?: string;
  salario?: number | string;
  Salario?: number | string;
  precio?: number | string;
  nombre_prestador?: string;
  NombrePrestador?: string;
  calificacion?: number | string;
  promedio_calificacion?: number | string;
  disponibilidad?: string;
  Disponibilidad?: string;
  experiencia?: string;
  habilidades?: string;
};

export type RequestItem = {
  id?: number;
  SolicitudId?: number;
  titulo?: string;
  Titulo?: string;
  estado?: string;
  Estado?: string;
  fecha_servicio?: string;
  FechaServicio?: string;
  cliente?: string;
  prestador?: string;
  mensaje?: string;
  Mensaje?: string;
};
