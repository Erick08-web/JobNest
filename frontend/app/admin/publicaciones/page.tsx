"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Eye, ImageIcon, RotateCcw, Search, XCircle } from "lucide-react";
import { CompactDashboardRail } from "../../components/SessionNav";
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

function money(value: number | null) {
  return value ? `$${value.toLocaleString("es-MX")}` : "Cotizar";
}

function statusClass(value: boolean | string) {
  if (typeof value === "boolean") return value ? "aceptada" : "rechazada";
  return value.toLowerCase().replace(/\s+/g, "-");
}

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
    return { label, before: String(before ?? "Sin dato"), after: String(after ?? "Sin dato"), changed: String(before ?? "") !== String(after ?? "") };
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
      if (first) setDetail(await getAdminPublication(first));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible cargar publicaciones.");
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
    if (!window.confirm(`¿Confirmas cambiar la publicación a ${estado}?`)) return;
    setWorkingId(`review-${estado}`);
    setMessage("");
    try {
      const result = await reviewAdminPublication(detail.id, { estado, comentario: note, version_id: detail.version_actual.id });
      setMessage(result.message || "Revisión guardada.");
      setNote("");
      await loadList();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible guardar la revisión.");
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
      setMessage(err instanceof Error ? err.message : "No fue posible reactivar.");
    } finally {
      setWorkingId(null);
    }
  };

  const updateImage = async (imageId: number, action: "aprobar" | "rechazar") => {
    setWorkingId(`image-${imageId}-${action}`);
    try {
      const result = action === "aprobar" ? await approveAdminImage(imageId) : await rejectAdminImage(imageId, imageReason);
      setMessage(result.message || "Imagen actualizada.");
      setImageReason("");
      if (selectedId) setDetail(await getAdminPublication(selectedId));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible actualizar la imagen.");
    } finally {
      setWorkingId(null);
    }
  };

  const compareRows = fieldRows(detail?.version_publica, detail?.version_actual);
  const selectedImages = detail?.imagenes.filter((item) => item.version_id === detail.version_actual?.id) ?? [];

  return (
    <main className="dashboardV2 adminDashboard">
      <CompactDashboardRail role="administrador" />
      <section className="dashboardCanvas">
        <header className="adminSectionHeader">
          <div><span className="sectionKicker"><ClipboardList size={16} /> Moderación</span><h1>Publicaciones</h1><p>Valida datos, imágenes y versiones antes de que los cambios sean públicos.</p></div>
          <Link href="/admin">Resumen</Link>
        </header>

        {message ? <div className="formAlert moduleAlert">{message}</div> : null}
        {loading ? <div className="portfolioEmpty"><Search size={30} /><h3>Cargando publicaciones...</h3></div> : null}

        <div className="adminModerationLayout">
          <section className="dashPanel adminTablePanel">
            <div className="sectionTitleRow">
              <div><span className="sectionKicker">Cola</span><h2>Publicaciones</h2></div>
            </div>
            <label className="adminSearch wide"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por oficio, prestador o título" /></label>
            <select className="adminFilter" value={filter} onChange={(event) => setFilter(event.target.value as PublicationState | "todas")}>
              {REVIEW_STATES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
            </select>
            <div className="adminListStack">
              {filtered.map((item) => (
                <button className={`adminListItem ${selectedId === item.id ? "active" : ""}`} type="button" key={item.id} onClick={() => void selectPublication(item.id)}>
                  <strong>{item.titulo}</strong>
                  <span>{item.categoria} · {item.prestador_nombre}</span>
                  <small>v{item.version_numero} · {item.estado_revision}</small>
                </button>
              ))}
              {!filtered.length ? <p className="mutedPanelText">No hay publicaciones para este filtro.</p> : null}
            </div>
          </section>

          <section className="dashPanel adminTablePanel">
            {!detail ? <div className="portfolioEmpty"><Eye size={28} /><h3>Selecciona una publicación.</h3></div> : (
              <>
                <div className="sectionTitleRow">
                  <div><span className="sectionKicker">Detalle</span><h2>{detail.version_actual?.titulo}</h2></div>
                  <span className={`statusPill ${statusClass(detail.version_actual?.estado || "pendiente_revision")}`}>{detail.version_actual?.estado}</span>
                </div>
                <div className="adminProviderStrip">
                  <strong>{detail.prestador.nombre}</strong>
                  <span>{detail.prestador.email}</span>
                  <span className={`statusPill ${statusClass(detail.prestador.activo)}`}>{detail.prestador.activo ? "Cuenta activa" : "Cuenta inactiva"}</span>
                </div>

                <div className="adminCompareGrid">
                  {compareRows.map((row) => (
                    <article className={row.changed ? "changed" : ""} key={row.label}>
                      <span>{row.label}</span>
                      <div><small>Publicado</small><strong>{row.before}</strong></div>
                      <div><small>Propuesto</small><strong>{row.after}</strong></div>
                    </article>
                  ))}
                </div>

                <div className="sectionTitleRow compactTitle"><div><span className="sectionKicker"><ImageIcon size={15} /> Imágenes</span><h2>Galería de versión</h2></div></div>
                <input className="adminFilter imageReasonInput" value={imageReason} onChange={(event) => setImageReason(event.target.value)} placeholder="Motivo para rechazar imagen" />
                <div className="adminImageGrid">
                  {selectedImages.map((image) => (
                    <article key={image.id}>
                      <img src={image.imagen_url} alt="Imagen de publicación" />
                      <span className={`statusPill ${statusClass(image.estado_revision)}`}>{image.estado_revision}</span>
                      {image.motivo_rechazo ? <small>{image.motivo_rechazo}</small> : null}
                      <div>
                        <button type="button" onClick={() => void updateImage(image.id, "aprobar")} disabled={workingId === `image-${image.id}-aprobar`}>Aprobar</button>
                        <button type="button" className="dangerButton" onClick={() => void updateImage(image.id, "rechazar")} disabled={workingId === `image-${image.id}-rechazar`}>Rechazar</button>
                      </div>
                    </article>
                  ))}
                  {!selectedImages.length ? <p className="mutedPanelText">Esta versión no tiene imágenes propias.</p> : null}
                </div>

                <textarea className="adminReviewNote" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Observaciones o motivo para esta publicación" />
                <div className="adminActionBar">
                  <button type="button" onClick={() => void review("aprobada")} disabled={workingId === "review-aprobada"}><CheckCircle2 size={15} /> Aprobar versión</button>
                  <button type="button" onClick={() => void review("correcciones_solicitadas")} disabled={workingId === "review-correcciones_solicitadas"}>Correcciones</button>
                  <button type="button" className="dangerButton" onClick={() => void review("rechazada")} disabled={workingId === "review-rechazada"}><XCircle size={15} /> Rechazar</button>
                  <button type="button" className="dangerButton" onClick={() => void review("suspendida")} disabled={workingId === "review-suspendida"}>Suspender</button>
                  <button type="button" onClick={() => void review("oculta")} disabled={workingId === "review-oculta"}>Ocultar</button>
                  <button type="button" onClick={() => void reactivate()} disabled={workingId === "reactivar"}><RotateCcw size={15} /> Reactivar</button>
                </div>

                <div className="adminRevisionLog">
                  <h3>Historial de revisiones</h3>
                  {detail.revisiones.map((item) => <p key={item.id}><strong>{item.accion}</strong> · {item.estado_anterior} → {item.estado_nuevo} · {item.creado_en}<span>{item.observaciones}</span></p>)}
                  {!detail.revisiones.length ? <p className="mutedPanelText">Aún no hay revisiones.</p> : null}
                </div>
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
