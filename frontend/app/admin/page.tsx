"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  Power,
  Search,
  ShieldCheck,
  UsersRound,
  XCircle
} from "lucide-react";
import {
  fetchCurrentUser,
  getAdminSummary,
  listAdminAuditEvents,
  listAdminComplaints,
  listAdminPublications,
  listAdminRequests,
  listAdminUsers,
  resolveAdminComplaint,
  reviewAdminPublication,
  toggleAdminPublication,
  toggleAdminUser,
  type AdminAuditEvent,
  type AdminComplaint,
  type AdminPublication,
  type AdminRequest,
  type AdminSummary,
  type AdminUser,
  type CurrentUser
} from "../lib/api";
import { CompactDashboardRail } from "../components/SessionNav";

function money(value: number) {
  return `$${value.toLocaleString("es-MX")}`;
}

function statusClass(value: boolean | string) {
  if (typeof value === "boolean") return value ? "aceptada" : "rechazada";
  return value.toLowerCase().replace(/\s+/g, "-");
}

export default function AdminDashboardPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [publications, setPublications] = useState<AdminPublication[]>([]);
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [complaints, setComplaints] = useState<AdminComplaint[]>([]);
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>([]);
  const [query, setQuery] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [complaintReply, setComplaintReply] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const current = await fetchCurrentUser();
      if (!current) throw new Error("Inicia sesión como administrador para ver este panel.");
      setUser(current);
      if (current.tipo_usuario !== "administrador") throw new Error("Esta sección está reservada para administradores.");

      const [summaryData, userItems, publicationItems, requestItems, complaintItems, auditItems] = await Promise.all([
        getAdminSummary(),
        listAdminUsers(),
        listAdminPublications(),
        listAdminRequests(),
        listAdminComplaints(),
        listAdminAuditEvents()
      ]);

      setSummary(summaryData);
      setUsers(userItems);
      setPublications(publicationItems);
      setRequests(requestItems);
      setComplaints(complaintItems);
      setAuditEvents(auditItems);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible cargar el dashboard administrador.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((item) => `${item.nombre} ${item.email} ${item.tipo_usuario}`.toLowerCase().includes(term));
  }, [query, users]);
  const pendingPublications = publications.filter((item) => item.estado_revision === "pendiente");

  const handleToggleUser = async (id: number) => {
    setWorkingId(`user-${id}`);
    setMessage("");
    try {
      const result = await toggleAdminUser(id);
      setMessage(result.message || "Usuario actualizado.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible actualizar el usuario.");
    } finally {
      setWorkingId(null);
    }
  };

  const handleTogglePublication = async (id: number) => {
    setWorkingId(`publication-${id}`);
    setMessage("");
    try {
      const result = await toggleAdminPublication(id);
      setMessage(result.message || "Publicación actualizada.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible actualizar la publicación.");
    } finally {
      setWorkingId(null);
    }
  };

  const handleReviewPublication = async (id: number, estado: "aprobada" | "rechazada") => {
    setWorkingId(`review-${id}-${estado}`);
    setMessage("");
    try {
      const result = await reviewAdminPublication(id, { estado, comentario: reviewNote });
      setMessage(result.message || "Revisión guardada.");
      setReviewNote("");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible guardar la revisión.");
    } finally {
      setWorkingId(null);
    }
  };

  const handleResolveComplaint = async (id: number, estado: "en_revision" | "resuelta") => {
    setWorkingId(`complaint-${id}-${estado}`);
    setMessage("");
    try {
      const result = await resolveAdminComplaint(id, { estado, respuesta: complaintReply });
      setMessage(result.message || "Queja actualizada.");
      setComplaintReply("");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible actualizar la queja.");
    } finally {
      setWorkingId(null);
    }
  };

  if (message && !summary && !loading) {
    return (
      <main className="dashboardV2 adminDashboard">
        <CompactDashboardRail role="administrador" />
        <section className="dashboardCanvas">
          <div className="portfolioEmpty adminAccessBox">
            <ShieldCheck size={34} />
            <h3>{message}</h3>
            <p>El panel administrador requiere una sesión con rol administrador en Flask.</p>
            <Link href="/login">Iniciar sesión</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboardV2 adminDashboard">
      <CompactDashboardRail role="administrador" />
      <section className="dashboardCanvas">
        <div className="dashboardHeroCard adminHero">
          <span className="sectionKicker"><ShieldCheck size={16} /> Dashboard administrador</span>
          <h1>{user ? `Control general, ${user.nombres}.` : "Centro de administración JobNest."}</h1>
          <p>Usuarios, publicaciones, solicitudes y señales operativas conectadas a Flask y SQL Server.</p>
          <button className="primaryButton" onClick={() => void load()}><Activity size={18} /> Actualizar datos</button>
        </div>

        {message ? <div className="formAlert moduleAlert">{message}</div> : null}
        {loading ? <div className="portfolioEmpty"><Search size={30} /><h3>Cargando panel administrador...</h3></div> : null}

        <div className="metricGrid adminMetricGrid">
          <article><UsersRound /><strong>{summary?.usuarios ?? 0}</strong><span>Usuarios totales</span></article>
          <article><BriefcaseBusiness /><strong>{summary?.prestadores ?? 0}</strong><span>Prestadores</span></article>
          <article><ClipboardList /><strong>{summary?.publicaciones_pendientes ?? 0}</strong><span>Publicaciones por revisar</span></article>
          <article><CreditCard /><strong>{money(summary?.pagos_total ?? 0)}</strong><span>Pagos registrados</span></article>
        </div>

        <section className="adminStatusStrip">
          <article><CheckCircle2 /><strong>{summary?.usuarios_activos ?? 0}</strong><span>usuarios activos</span></article>
          <article><BadgeCheck /><strong>{summary?.publicaciones_activas ?? 0}</strong><span>publicaciones activas</span></article>
          <article><AlertTriangle /><strong>{summary?.quejas_pendientes ?? 0}</strong><span>quejas pendientes</span></article>
          <article><XCircle /><strong>{summary?.publicaciones_rechazadas ?? 0}</strong><span>publicaciones rechazadas</span></article>
        </section>

        <div className="dashboardColumns adminColumns">
          <section className="dashPanel adminTablePanel">
            <div className="sectionTitleRow"><div><span className="sectionKicker">Revisión</span><h2>Publicaciones pendientes</h2></div><Link href="/buscar">Ver marketplace</Link></div>
            <textarea className="adminReviewNote" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Observaciones o motivo de rechazo para el prestador" />
            <div className="adminPublicationGrid">
              {pendingPublications.slice(0, 6).map((item) => (
                <article className="adminPublicationCard reviewCard" key={item.id}>
                  <div><strong>{item.titulo}</strong><span>{item.categoria} · {item.prestador_nombre}</span></div>
                  <p>{item.descripcion}</p>
                  <small>{item.ubicacion} · {item.experiencia ?? 0} años · {item.habilidades || "Sin habilidades"}</small>
                  <div>
                    <button type="button" onClick={() => void handleReviewPublication(item.id, "aprobada")} disabled={workingId === `review-${item.id}-aprobada`}><CheckCircle2 size={15} /> Aprobar</button>
                    <button type="button" className="dangerButton" onClick={() => void handleReviewPublication(item.id, "rechazada")} disabled={workingId === `review-${item.id}-rechazada`}><XCircle size={15} /> Rechazar</button>
                  </div>
                </article>
              ))}
              {!pendingPublications.length ? <p className="mutedPanelText">No hay publicaciones pendientes de revisión.</p> : null}
            </div>
          </section>

          <section className="dashPanel adminTablePanel">
            <div className="sectionTitleRow"><div><span className="sectionKicker">Quejas</span><h2>Bandeja de atención</h2></div></div>
            <textarea className="adminReviewNote" value={complaintReply} onChange={(event) => setComplaintReply(event.target.value)} placeholder="Respuesta o acción tomada por administración" />
            <div className="adminTable compact">
              {complaints.slice(0, 8).map((item) => (
                <article className="adminTableRow complaintRow" key={item.id}>
                  <div><strong>{item.motivo}</strong><span>{item.usuario_nombre} · {item.tipo_usuario} · {item.descripcion}</span></div>
                  <span className={`statusPill ${statusClass(item.estado)}`}>{item.estado}</span>
                  <button type="button" onClick={() => void handleResolveComplaint(item.id, "en_revision")} disabled={workingId === `complaint-${item.id}-en_revision`}>Revisar</button>
                  <button type="button" onClick={() => void handleResolveComplaint(item.id, "resuelta")} disabled={workingId === `complaint-${item.id}-resuelta`}>Resolver</button>
                </article>
              ))}
              {!complaints.length ? <p className="mutedPanelText">Aún no hay quejas.</p> : null}
            </div>
          </section>
        </div>

        <div className="dashboardColumns adminColumns">
          <section className="dashPanel adminTablePanel">
            <div className="sectionTitleRow">
              <div><span className="sectionKicker">Usuarios</span><h2>Cuentas recientes</h2></div>
              <label className="adminSearch"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar usuario" /></label>
            </div>
            <div className="adminTable">
              {filteredUsers.map((item) => (
                <article className="adminTableRow" key={item.id}>
                  <div><strong>{item.nombre}</strong><span>{item.email}</span></div>
                  <span className={`statusPill ${item.tipo_usuario}`}>{item.tipo_usuario}</span>
                  <span className={`statusPill ${statusClass(item.activo)}`}>{item.activo ? "Activo" : "Inactivo"}</span>
                  <button type="button" onClick={() => void handleToggleUser(item.id)} disabled={workingId === `user-${item.id}`}>
                    <Power size={16} /> {item.activo ? "Desactivar" : "Activar"}
                  </button>
                </article>
              ))}
              {!filteredUsers.length ? <p className="mutedPanelText">No hay usuarios con ese filtro.</p> : null}
            </div>
          </section>

          <section className="dashPanel adminTablePanel">
            <div className="sectionTitleRow"><div><span className="sectionKicker">Solicitudes</span><h2>Actividad reciente</h2></div></div>
            <div className="adminTable compact">
              {requests.slice(0, 10).map((item) => (
                <article className="adminTableRow requestRow" key={item.id}>
                  <div><strong>{item.titulo_publicacion}</strong><span>{item.cliente_nombre || "Cliente"} a {item.prestador_nombre || "Prestador"}</span></div>
                  <span className={`statusPill ${statusClass(item.estado)}`}>{item.estado}</span>
                  <span>{item.fecha_servicio || item.fecha_solicitud}</span>
                </article>
              ))}
              {!requests.length ? <p className="mutedPanelText">Aún no hay solicitudes.</p> : null}
            </div>
            <div className="adminStateList">
              {(summary?.solicitudes_por_estado ?? []).map((item) => <span key={item.estado}>{item.estado}: <strong>{item.total}</strong></span>)}
            </div>
          </section>
        </div>

        <section className="dashPanel adminTablePanel">
          <div className="sectionTitleRow"><div><span className="sectionKicker">Publicaciones</span><h2>Servicios publicados</h2></div><Link href="/buscar">Ver marketplace</Link></div>
          <div className="adminPublicationGrid">
            {publications.slice(0, 12).map((item) => (
              <article className="adminPublicationCard" key={item.id}>
                <div><strong>{item.titulo}</strong><span>{item.categoria} · {item.prestador_nombre}</span></div>
                <p>{item.precio ? money(item.precio) : "Cotizar"} · {item.fecha_creacion}</p>
                <div>
                  <span className={`statusPill ${statusClass(item.estado_revision)}`}>{item.estado_revision}</span>
                  <span className={`statusPill ${statusClass(item.activa)}`}>{item.activa ? "Activa" : "Inactiva"}</span>
                  <button type="button" onClick={() => void handleTogglePublication(item.id)} disabled={workingId === `publication-${item.id}`}>
                    {item.activa ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </article>
            ))}
            {!publications.length ? <p className="mutedPanelText">Aún no hay publicaciones.</p> : null}
          </div>
        </section>

        <section className="dashPanel adminTablePanel">
          <div className="sectionTitleRow"><div><span className="sectionKicker">Bitácora</span><h2>Eventos monitoreados</h2></div><FileText /></div>
          <div className="adminTable compact">
            {auditEvents.slice(0, 12).map((item) => (
              <article className="adminTableRow auditRow" key={item.id}>
                <div><strong>{item.tipo_evento}</strong><span>{item.entidad} #{item.entidad_id ?? "-"} · {item.detalle}</span></div>
                <span>{item.creado_en}</span>
              </article>
            ))}
            {!auditEvents.length ? <p className="mutedPanelText">Aún no hay eventos registrados.</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
