"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Eye,
  Power,
  Search,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import {
  fetchCurrentUser,
  getAdminSummary,
  listAdminPublications,
  listAdminRequests,
  listAdminUsers,
  toggleAdminPublication,
  toggleAdminUser,
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
  const [query, setQuery] = useState("");
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

      const [summaryData, userItems, publicationItems, requestItems] = await Promise.all([
        getAdminSummary(),
        listAdminUsers(),
        listAdminPublications(),
        listAdminRequests()
      ]);

      setSummary(summaryData);
      setUsers(userItems);
      setPublications(publicationItems);
      setRequests(requestItems);
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
          <article><ClipboardList /><strong>{summary?.solicitudes ?? 0}</strong><span>Solicitudes</span></article>
          <article><CreditCard /><strong>{money(summary?.pagos_total ?? 0)}</strong><span>Pagos registrados</span></article>
        </div>

        <section className="adminStatusStrip">
          <article><CheckCircle2 /><strong>{summary?.usuarios_activos ?? 0}</strong><span>usuarios activos</span></article>
          <article><BadgeCheck /><strong>{summary?.publicaciones_activas ?? 0}</strong><span>publicaciones activas</span></article>
          <article><Eye /><strong>{summary?.mensajes ?? 0}</strong><span>mensajes enviados</span></article>
          <article><ShieldCheck /><strong>{summary?.resenas ?? 0}</strong><span>reseñas capturadas</span></article>
        </section>

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
      </section>
    </main>
  );
}
