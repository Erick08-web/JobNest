"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Eye, ImageIcon, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminEmptyState,
  AdminPageHeader,
  AdminSearch,
  AdminSectionTitle,
  AdminSelect,
  AdminShell,
  AdminSkeleton,
  AdminToolbar,
  formatAdminMoney,
  humanizeAdminText,
  statusTone
} from "../components/AdminUI";
import {
  approveAdminImage,
  fetchCurrentUser,
  getAdminPublication,
  listAdminPublications,
  reactivateAdminPublication,
  rejectAdminImage,
  reviewAdminPublication,
  type AdminPublication,
  type AdminPublicationDetail,
  type AdminPublicationVersion,
  type PublicationState
} from "../../lib/api";

const REVIEW_STATES: { value: PublicationState | "todas"; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "pendiente_revision", label: "Pendientes" },
  { value: "correcciones_solicitadas", label: "Correcciones" },
  { value: "aprobada", label: "Aprobadas" },
  { value: "rechazada", label: "Rechazadas" },
  { value: "suspendida", label: "Suspendidas" },
  { value: "oculta", label: "Ocultas" }
];

function fieldRows(current?: AdminPublicationVersion | null, proposed?: AdminPublicationVersion | null) {
  const fields: [string, keyof AdminPublicationVersion][] = [
    ["Título", "titulo"],
    ["Categoría", "categoria"],
    ["Descripción", "descripcion"],
    ["Precio", "precio"],
    ["Cobro", "tipo_precio"],
    ["Ubicación", "ubicacion"],
    ["Experiencia", "experiencia"],
    ["Habilidades", "habilidades"],
    ["Disponibilidad", "disponibilidad"],
    ["Materiales", "incluye_materiales"]
  ];
  return fields.map(([label, key]) => {
    const before = current?.[key];
    const after = proposed?.[key];
    const format = (value: unknown) => {
      if (typeof value === "boolean") return value ? "Sí" : "No";
      if (key === "precio") return typeof value === "number" ? formatAdminMoney(value) : "Cotizar";
      return String(value ?? "Sin dato");
    };
    return { label, before: format(before), after: format(after), changed: String(before ?? "") !== String(after ?? "") };
  });
}

export default function AdminPublicationsPage() {
  const [publications, setPublications] = useState<AdminPublication[]>([]);
  const [detail, setDetail] = useState<AdminPublicationDetail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [imageReason, setImageReason] = useState("");
  const [filter, setFilter] = useState<PublicationState | "todas">("todas");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const loadList = async () => {
    setLoading(true);
    setMessage("");
    try {
      const current = await fetchCurrentUser();
      if (!current || current.tipo_usuario !== "administrador") throw new Error("Acceso reservado para administradores.");
      const items = await listAdminPublications();
      setPublications(items);
      const first = selectedId ?? items[0]?.id ?? null;
      setSelectedId(first);
      setDetail(first ? await getAdminPublication(first) : null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No pudimos cargar la información. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadList(); }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return publications.filter((item) => {
      const byState = filter === "todas" || item.estado_revision === filter;
      const byTerm = !term || `${item.titulo} ${item.categoria} ${item.prestador_nombre} ${item.prestador_email}`.toLowerCase().includes(term);
      return byState && byTerm;
    });
  }, [filter, publications, query]);

  const selectPublication = async (id: number) => {
    setSelectedId(id);
    setMessage("");
    setDetail(await getAdminPublication(id));
  };

  const review = async (estado: Exclude<PublicationState, "borrador">) => {
    if (!detail?.version_actual) return;
    if (["rechazada", "suspendida", "correcciones_solicitadas"].includes(estado) && !note.trim()) {
      setMessage("Agrega una observación para esta acción.");
      return;
    }
    if (!window.confirm(`¿Confirmas cambiar esta publicación a "${humanizeAdminText(estado)}"?`)) return;
    setWorkingId(`review-${estado}`);
    setMessage("");
    try {
      const result = await reviewAdminPublication(detail.id, { estado, comentario: note, version_id: detail.version_actual.id });
      setMessage(result.message || "Revisión guardada.");
      setNote("");
      await loadList();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No pudimos completar la acción. Inténtalo nuevamente.");
    } finally {
      setWorkingId(null);
    }
  };

  const reactivate = async () => {
    if (!detail) return;
    if (!window.confirm("¿Confirmas reactivar esta publicación aprobada?")) return;
    setWorkingId("reactivar");
    try {
      const result = await reactivateAdminPublication(detail.id, note);
      setMessage(result.message || "Publicación reactivada.");
      setNote("");
      await loadList();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No pudimos completar la acción. Inténtalo nuevamente.");
    } finally {
      setWorkingId(null);
    }
  };

  const updateImage = async (imageId: number, action: "aprobar" | "rechazar") => {
    if (action === "rechazar" && !imageReason.trim()) {
      setMessage("Agrega un motivo para rechazar la imagen.");
      return;
    }
    setWorkingId(`image-${imageId}-${action}`);
    try {
      const result = action === "aprobar" ? await approveAdminImage(imageId) : await rejectAdminImage(imageId, imageReason);
      setMessage(result.message || "Imagen actualizada.");
      setImageReason("");
      if (selectedId) setDetail(await getAdminPublication(selectedId));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No pudimos completar la acción. Inténtalo nuevamente.");
    } finally {
      setWorkingId(null);
    }
  };

  const compareRows = fieldRows(detail?.version_publica, detail?.version_actual);
  const selectedImages = detail?.imagenes.filter((item) => item.version_id === detail.version_actual?.id) ?? [];

  return (
    <AdminShell title="Publicaciones" description="Moderación de contenido, versiones e imágenes.">
      <AdminPageHeader
        eyebrow="Moderación"
        title="Control de publicaciones"
        description="Valida datos, imágenes y cambios antes de que una publicación sea visible para clientes."
        icon={ClipboardList}
      />
      {message ? <AdminAlert tone={message.includes("guardada") || message.includes("actualizada") || message.includes("reactivada") ? "success" : "danger"}>{message}</AdminAlert> : null}
      {loading ? <AdminSkeleton rows={5} /> : null}

      {!loading && !publications.length ? (
        <AdminEmptyState icon={ShieldCheck} title="No hay publicaciones por administrar" description="Cuando un prestador cree o actualice una publicación, aparecerá aquí para revisión." />
      ) : null}

      {!loading && publications.length ? (
        <div className="adminModerationGrid">
          <AdminCard>
            <AdminSectionTitle eyebrow="Cola" title={`${filtered.length} publicaciones`} />
            <AdminToolbar>
              <AdminSearch value={query} onChange={setQuery} placeholder="Buscar por servicio, prestador o categoría" />
              <AdminSelect value={filter} onChange={(value) => setFilter(value as PublicationState | "todas")} label="Estado">
                {REVIEW_STATES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
              </AdminSelect>
            </AdminToolbar>
            <div className="adminList">
              {filtered.map((item) => (
                <button className={`adminQueueItem ${selectedId === item.id ? "isActive" : ""}`} type="button" key={item.id} onClick={() => void selectPublication(item.id)}>
                  <strong>{item.titulo}</strong>
                  <span>{item.categoria} · {item.prestador_nombre}</span>
                  <small>Versión {item.version_numero} · {humanizeAdminText(item.estado_revision)}</small>
                </button>
              ))}
              {!filtered.length ? <AdminEmptyState icon={Eye} title="Sin resultados" description="No hay publicaciones que coincidan con esos filtros." /> : null}
            </div>
          </AdminCard>

          <AdminCard>
            {!detail ? <AdminEmptyState icon={Eye} title="Selecciona una publicación" description="El detalle aparecerá aquí para revisar contenido, imágenes e historial." /> : (
              <div className="adminGrid">
                <AdminSectionTitle
                  eyebrow="Detalle"
                  title={detail.version_actual?.titulo || "Publicación"}
                  action={<AdminBadge tone={statusTone(detail.version_actual?.estado)}>{humanizeAdminText(detail.version_actual?.estado)}</AdminBadge>}
                />
                <div className="adminProviderCard">
                  <strong>{detail.prestador.nombre}</strong>
                  <span className="adminMetaText">{detail.prestador.email}</span>
                  <AdminBadge tone={statusTone(detail.prestador.activo)}>{detail.prestador.activo ? "Cuenta activa" : "Cuenta inactiva"}</AdminBadge>
                  <AdminBadge tone={statusTone(detail.activa)}>{detail.activa ? "Visible" : "No visible"}</AdminBadge>
                </div>

                <AdminSectionTitle eyebrow="Contenido" title="Cambios propuestos" />
                <div className="adminDetailGrid">
                  {compareRows.map((row) => (
                    <article className={`adminFieldCompare ${row.changed ? "changed" : ""}`} key={row.label}>
                      <strong>{row.label}</strong>
                      <div><small>Publicado</small><span>{row.before}</span></div>
                      <div><small>Propuesto</small><span>{row.after}</span></div>
                    </article>
                  ))}
                </div>

                <AdminSectionTitle eyebrow="Imágenes" title="Galería de versión" />
                <input className="adminReviewNote" value={imageReason} onChange={(event) => setImageReason(event.target.value)} placeholder="Motivo para rechazar imagen" aria-label="Motivo para rechazar imagen" />
                <div className="adminImageGrid2">
                  {selectedImages.map((image) => (
                    <article className="adminImageCard" key={image.id}>
                      <img src={image.imagen_url} alt="Imagen de publicación" />
                      <AdminBadge tone={statusTone(image.estado_revision)}>{humanizeAdminText(image.estado_revision)}</AdminBadge>
                      {image.motivo_rechazo ? <span className="adminMetaText">{image.motivo_rechazo}</span> : null}
                      <div className="adminActionBar">
                        <AdminButton type="button" tone="success" onClick={() => void updateImage(image.id, "aprobar")} disabled={workingId === `image-${image.id}-aprobar`}>Aprobar</AdminButton>
                        <AdminButton type="button" tone="danger" onClick={() => void updateImage(image.id, "rechazar")} disabled={workingId === `image-${image.id}-rechazar`}>Rechazar</AdminButton>
                      </div>
                    </article>
                  ))}
                  {!selectedImages.length ? <AdminEmptyState icon={ImageIcon} title="Sin imágenes en esta versión" description="La publicación no incluye imágenes pendientes para esta versión." /> : null}
                </div>

                <AdminSectionTitle eyebrow="Acciones" title="Decisión administrativa" />
                <textarea className="adminReviewNote" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Observaciones o motivo para esta decisión" aria-label="Observaciones de revisión" />
                <div className="adminActionBar">
                  <AdminButton type="button" tone="success" onClick={() => void review("aprobada")} disabled={workingId === "review-aprobada"}><CheckCircle2 size={15} /> Aprobar</AdminButton>
                  <AdminButton type="button" onClick={() => void review("correcciones_solicitadas")} disabled={workingId === "review-correcciones_solicitadas"}>Pedir correcciones</AdminButton>
                  <AdminButton type="button" tone="danger" onClick={() => void review("rechazada")} disabled={workingId === "review-rechazada"}><XCircle size={15} /> Rechazar</AdminButton>
                  <AdminButton type="button" tone="danger" onClick={() => void review("suspendida")} disabled={workingId === "review-suspendida"}>Suspender</AdminButton>
                  <AdminButton type="button" onClick={() => void review("oculta")} disabled={workingId === "review-oculta"}>Ocultar</AdminButton>
                  <AdminButton type="button" onClick={() => void reactivate()} disabled={workingId === "reactivar"}><RotateCcw size={15} /> Reactivar</AdminButton>
                </div>

                <AdminSectionTitle eyebrow="Historial" title="Revisiones registradas" />
                <div className="adminTimeline">
                  {detail.revisiones.map((item) => (
                    <article className="adminTimelineItem" key={item.id}>
                      <span><ClipboardList size={15} /></span>
                      <div>
                        <strong>{humanizeAdminText(item.accion)}</strong>
                        <p>{humanizeAdminText(item.estado_anterior)} → {humanizeAdminText(item.estado_nuevo)} · {item.creado_en}</p>
                        {item.observaciones ? <p>{item.observaciones}</p> : null}
                      </div>
                    </article>
                  ))}
                  {!detail.revisiones.length ? <AdminEmptyState icon={ClipboardList} title="Sin historial" description="Las decisiones de moderación aparecerán aquí." /> : null}
                </div>
              </div>
            )}
          </AdminCard>
        </div>
      ) : null}
    </AdminShell>
  );
}
