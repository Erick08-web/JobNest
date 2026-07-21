export type CurrentUser = {
  correo: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  telefono?: string;
  foto_perfil?: string | null;
  tipo_usuario: "cliente" | "prestador";
  fecha_registro?: string;
  ultima_sesion?: string;
};

export type ApiResult<T = unknown> = T & {
  success?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

export async function backendFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(`/api/backend${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.message || "No fue posible completar la solicitud."), {
      status: response.status,
      data
    });
  }
  return data as ApiResult<T>;
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await backendFetch<CurrentUser>("/get_user_data") as CurrentUser;
  } catch {
    return null;
  }
}

export async function loginUser(email: string, password: string) {
  const formData = new FormData();
  formData.append("email", email);
  formData.append("password", password);
  return backendFetch("/login", { method: "POST", body: formData });
}

export async function registerUser(payload: {
  firstName: string;
  lastNameP: string;
  lastNameM: string;
  candidatePhone: string;
  email: string;
  password: string;
  confirmPassword: string;
  userType: "cliente" | "prestador";
}) {
  return backendFetch("/registrar_usuario_web", {
    method: "POST",
    body: JSON.stringify({ ...payload, termsCheck: "on" })
  });
}

export async function logoutUser() {
  await fetch("/api/backend/logout", { credentials: "include" }).catch(() => null);
}


export type Publication = {
  id: number;
  titulo: string;
  descripcion: string;
  categoria: string;
  precio: number | null;
  precio_texto?: string;
  ubicacion: string;
  experiencia: number;
  habilidades: string;
  disponibilidad: string;
  incluye_materiales: boolean;
  tipo_precio: string;
  fecha_creacion: string;
  activa?: boolean;
  prestador_nombre?: string;
  prestador_telefono?: string;
  prestador_foto?: string | null;
  prestador_email?: string;
  prestador_id?: number;
};

export type PortfolioWork = {
  id: number;
  titulo: string;
  descripcion: string;
  imagen_url: string;
  creado_en: string;
  publicacion_titulo?: string;
  categoria?: string;
};

export type RequestItem = {
  id: number;
  fecha_solicitud: string;
  fecha_servicio: string;
  hora_servicio: string;
  mensaje_cliente: string;
  estado: string;
  titulo_publicacion: string;
  precio: number | null;
  categoria: string;
  prestador_nombre?: string;
  prestador_foto?: string | null;
  prestador_email?: string;
  cliente_nombre?: string;
  cliente_foto?: string | null;
  cliente_email?: string;
};

export async function listActivePublications() {
  const data = await backendFetch<{ publicaciones: Publication[] }>("/publicaciones_activas");
  return data.publicaciones ?? [];
}

export async function searchPublications(params: URLSearchParams) {
  const query = params.toString();
  const data = await backendFetch<{ publicaciones: Publication[] }>(`/buscar_publicaciones${query ? `?${query}` : ""}`);
  return data.publicaciones ?? [];
}

export async function getPublication(id: string | number) {
  const data = await backendFetch<{ publicacion: Publication }>(`/detalles_publicacion/${id}`);
  return data.publicacion;
}

export async function getPublicationPortfolio(id: string | number) {
  const data = await backendFetch<{ portafolio: PortfolioWork[] }>(`/portafolio_publicacion/${id}`);
  return data.portafolio ?? [];
}

export async function sendServiceRequest(payload: { publicacion_id: number; fecha_servicio: string; hora_servicio: string; mensaje: string }) {
  const formData = new FormData();
  formData.append("publicacion_id", String(payload.publicacion_id));
  formData.append("fecha_servicio", payload.fecha_servicio);
  formData.append("hora_servicio", payload.hora_servicio);
  formData.append("mensaje", payload.mensaje);
  return backendFetch("/enviar_solicitud", { method: "POST", body: formData });
}

export async function listClientRequests() {
  const data = await backendFetch<{ solicitudes: RequestItem[] }>("/mis_solicitudes_cliente");
  return data.solicitudes ?? [];
}

export async function listProviderRequests() {
  const data = await backendFetch<{ solicitudes: RequestItem[] }>("/mis_solicitudes_prestador");
  return data.solicitudes ?? [];
}


export type Conversation = {
  id: number;
  solicitud_id: number;
  titulo_publicacion: string;
  otro_usuario_id: number;
  otro_nombre: string;
  otro_foto?: string | null;
  ultimo_mensaje?: string;
  ultimo_enviado?: string;
};

export type ChatMessage = {
  id: number;
  emisor_id: number;
  cuerpo: string;
  enviado_en: string;
  emisor_nombre: string;
};

export type PendingPayment = {
  id: number;
  titulo: string;
  fecha_servicio: string;
  precio: number;
  prestador_nombre: string;
};

export type AgendaEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  extendedProps?: Record<string, unknown>;
};

export async function updateRequestStatus(id: number, estado: "aceptada" | "rechazada") {
  return backendFetch(`/actualizar_estado_solicitud/${id}`, {
    method: "POST",
    body: JSON.stringify({ estado })
  });
}

export async function markRequestDone(id: number) {
  return backendFetch(`/marcar_concluido/${id}`, { method: "POST" });
}

export async function listConversations() {
  const data = await backendFetch<{ conversaciones: Conversation[] }>("/mis_conversaciones");
  return data.conversaciones ?? [];
}

export async function listMessages(hiloId: number) {
  const data = await backendFetch<{ mensajes: ChatMessage[] }>(`/obtener_mensajes/${hiloId}`);
  return data.mensajes ?? [];
}

export async function sendMessage(payload: { hilo_id?: number; solicitud_id?: number; mensaje: string }) {
  return backendFetch<{ hilo_id: number }>("/enviar_mensaje", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function listPendingPayments() {
  const data = await backendFetch<{ solicitudes: PendingPayment[] }>("/obtener_solicitudes_pendientes_pago");
  return data.solicitudes ?? [];
}

export async function processPayment(payload: { solicitud_id: number; metodo: "efectivo" | "tarjeta"; monto: number; numero?: string; nombre?: string; expiracion?: string; cvv?: string }) {
  return backendFetch("/procesar_pago", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function listAgendaEvents() {
  const data = await backendFetch<{ eventos: AgendaEvent[] }>("/obtener_eventos_agenda");
  return data.eventos ?? [];
}


export type PublicationPayload = {
  titulo: string;
  descripcion: string;
  categoria: string;
  salario: string;
  ubicacion: string;
  experiencia: string;
  habilidades: string;
  disponibilidad: string;
  tipo_precio: string;
  incluye_materiales: boolean;
};

export async function listMyPublications() {
  const data = await backendFetch<{ publicaciones: Publication[] }>("/mis_publicaciones");
  return data.publicaciones ?? [];
}

export async function createPublication(payload: PublicationPayload) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (key === "incluye_materiales") {
      if (value) formData.append(key, "on");
    } else {
      formData.append(key, String(value));
    }
  });
  return backendFetch("/crear_publicacion", { method: "POST", body: formData });
}

export async function uploadPortfolioWork(payload: { publicacion_id: string; titulo: string; descripcion: string; imagen: File }) {
  const formData = new FormData();
  formData.append("publicacion_id", payload.publicacion_id);
  formData.append("titulo", payload.titulo);
  formData.append("descripcion", payload.descripcion);
  formData.append("imagen", payload.imagen);
  return backendFetch("/subir_trabajo_portafolio", { method: "POST", body: formData });
}


export type CompletedService = {
  id: number;
  titulo: string;
  nombre_contratante: string;
  fecha_servicio: string;
  precio: number | null;
  mi_calificacion?: number | null;
  mi_comentario?: string | null;
  calificacion_recibida?: number | null;
  comentario_recibido?: string | null;
};

export async function updateProfile(payload: { nombres: string; apellido_paterno: string; apellido_materno: string; telefono: string }) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
  return backendFetch("/actualizar_perfil", { method: "POST", body: formData });
}

export async function changePassword(payload: { contrasena_actual: string; nueva_contrasena: string; confirmar_nueva_contrasena: string }) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
  return backendFetch("/cambiar_contrasena", { method: "POST", body: formData });
}

export async function uploadProfilePhoto(file: File) {
  const formData = new FormData();
  formData.append("foto", file);
  return backendFetch<{ foto_url: string }>("/subir_foto_perfil", { method: "POST", body: formData });
}

export async function getOwnPublication(id: number) {
  const data = await backendFetch<{ publicacion: Publication }>(`/obtener_publicacion/${id}`);
  return data.publicacion;
}

export async function editPublication(id: number, payload: PublicationPayload) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (key === "incluye_materiales") {
      if (value) formData.append(key, "on");
    } else {
      formData.append(key, String(value));
    }
  });
  return backendFetch(`/editar_publicacion/${id}`, { method: "POST", body: formData });
}

export async function togglePublication(id: number) {
  return backendFetch(`/toggle_publicacion/${id}`, { method: "POST" });
}

export async function listCompletedServices() {
  const data = await backendFetch<{ servicios: CompletedService[] }>("/servicios_concluidos");
  return data.servicios ?? [];
}

export async function rateService(payload: { solicitud_id: number; calificacion: number; comentario: string; opcion_predeterminada: string }) {
  return backendFetch("/calificar_servicio", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
