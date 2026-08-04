export type UserType = 'Cliente' | 'Prestador';

export type SessionUser = {
  id?: number;
  nombre?: string;
  apellido?: string;
  apellido_materno?: string;
  email?: string;
  tipo_usuario?: UserType | string;
  estado_cuenta?: string;
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
  precio_texto?: string;
  tipo_precio?: string;
  fecha_creacion?: string;
  incluye_materiales?: boolean;
  nombre_prestador?: string;
  NombrePrestador?: string;
  prestador_nombre?: string;
  prestador_email?: string;
  prestador_foto?: string | null;
  imagen_principal?: string | null;
  imagenes?: string[];
  calificacion?: number | string;
  promedio_calificacion?: number | string;
  total_resenas?: number;
  disponibilidad?: string;
  Disponibilidad?: string;
  experiencia?: string;
  habilidades?: string;
};

export type Category = {
  nombre: string;
};

export type RequestItem = {
  id?: number;
  SolicitudId?: number;
  servicio?: string;
  Servicio?: string;
  publicacion_titulo?: string;
  PublicacionTitulo?: string;
  titulo?: string;
  Titulo?: string;
  estado?: string;
  Estado?: string;
  fecha_servicio?: string;
  FechaServicio?: string;
  cliente?: string;
  cliente_nombre?: string;
  ClienteNombre?: string;
  prestador?: string;
  prestador_nombre?: string;
  PrestadorNombre?: string;
  mensaje?: string;
  Mensaje?: string;
  precio?: number | null;
  mi_calificacion?: number | null;
  mi_comentario?: string | null;
  mi_resena_fecha?: string | null;
  pago_completado?: boolean;
};

export type ChatMessage = {
  id: number;
  emisor_id?: number | null;
  cuerpo: string;
  enviado_en?: string;
  emisor_nombre?: string;
  es_mio?: boolean;
  es_sistema?: boolean;
};

export type ChatThread = {
  success: boolean;
  hilo_id?: number | null;
  solicitud_id: number;
  servicio: string;
  contraparte: string;
  contraparte_foto?: string | null;
  mensajes: ChatMessage[];
};

export type MobileProfile = {
  usuario_id: number;
  email: string;
  rol: UserType | string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  telefono?: string;
  foto_perfil?: string | null;
  fecha_registro?: string;
  activo: boolean;
  profesional?: {
    verificado: boolean;
    rating_promedio: number | null;
    total_resenas: number;
  };
};

export type PortfolioWork = {
  id: number;
  publicacion_id: number;
  titulo: string;
  descripcion?: string;
  imagen_url?: string | null;
  activo: boolean;
  creado_en?: string;
  publicacion_titulo?: string;
  categoria?: string;
};

export type ProfileReview = {
  calificacion: number | null;
  comentario: string;
  fecha?: string;
  revisor_nombre?: string;
};

export type ProfileReviews = {
  promedio: number | null;
  total: number;
  resenas: ProfileReview[];
};
