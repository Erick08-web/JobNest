"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, AlertTriangle, BadgeCheck, BriefcaseBusiness, ClipboardList, CreditCard, FileText, Search, ShieldCheck, UsersRound, XCircle } from "lucide-react";
import { CompactDashboardRail } from "../components/SessionNav";
import { fetchCurrentUser, getAdminSummary, type AdminSummary, type CurrentUser } from "../lib/api";

function money(value: number) {
  return `$${value.toLocaleString("es-MX")}`;
}

export default function AdminDashboardPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const current = await fetchCurrentUser();
      if (!current) throw new Error("Inicia sesión como administrador para ver este panel.");
      if (current.tipo_usuario !== "administrador") throw new Error("Esta sección está reservada para administradores.");
      setUser(current);
      setSummary(await getAdminSummary());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible cargar el dashboard administrador.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

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
          <span className="sectionKicker"><ShieldCheck size={16} /> Centro de control</span>
          <h1>{user ? `Administración JobNest, ${user.nombres}.` : "Administración JobNest."}</h1>
          <p>Resumen operativo de usuarios, revisión de publicaciones, quejas, pagos y trazabilidad del sistema.</p>
          <button className="primaryButton" onClick={() => void load()}><Activity size={18} /> Actualizar resumen</button>
        </div>

        {message ? <div className="formAlert moduleAlert">{message}</div> : null}
        {loading ? <div className="portfolioEmpty"><Search size={30} /><h3>Cargando resumen...</h3></div> : null}

        <div className="metricGrid adminMetricGrid">
          <article><ClipboardList /><strong>{summary?.publicaciones_pendientes ?? 0}</strong><span>Publicaciones por revisar</span></article>
          <article><AlertTriangle /><strong>{summary?.quejas_pendientes ?? 0}</strong><span>Quejas pendientes</span></article>
          <article><AlertTriangle /><strong>{summary?.alertas_pendientes ?? 0}</strong><span>Alertas sin leer</span></article>
          <article><CreditCard /><strong>{money(summary?.pagos_total ?? 0)}</strong><span>Pagos registrados</span></article>
        </div>

        <section className="adminStatusStrip">
          <article><BadgeCheck /><strong>{summary?.publicaciones_activas ?? 0}</strong><span>publicaciones activas</span></article>
          <article><XCircle /><strong>{summary?.publicaciones_rechazadas ?? 0}</strong><span>rechazadas</span></article>
          <article><BriefcaseBusiness /><strong>{summary?.solicitudes_nuevas ?? 0}</strong><span>solicitudes nuevas</span></article>
          <article><ShieldCheck /><strong>{summary?.servicios_concluidos ?? 0}</strong><span>servicios concluidos</span></article>
        </section>

        <div className="dashboardColumns adminColumns">
          <section className="dashPanel adminTablePanel">
            <div className="sectionTitleRow"><div><span className="sectionKicker">Usuarios</span><h2>Estado de cuentas</h2></div><Link href="/admin/usuarios">Ver usuarios</Link></div>
            <div className="adminStateList">
              <span>Clientes activos: <strong>{summary?.clientes_activos ?? 0}</strong></span>
              <span>Clientes inactivos: <strong>{summary?.clientes_inactivos ?? 0}</strong></span>
              <span>Prestadores activos: <strong>{summary?.prestadores_activos ?? 0}</strong></span>
              <span>Prestadores inactivos: <strong>{summary?.prestadores_inactivos ?? 0}</strong></span>
              <span>Validación pendiente: <strong>{summary?.prestadores_pendientes_validacion ?? 0}</strong></span>
            </div>
          </section>
          <section className="dashPanel adminTablePanel">
            <div className="sectionTitleRow"><div><span className="sectionKicker">Pagos</span><h2>Estados registrados</h2></div><Link href="/admin/pagos">Ver pagos</Link></div>
            <div className="adminStateList">
              {(summary?.pagos_por_estado ?? []).map((item) => <span key={item.estado}>{item.estado}: <strong>{item.total}</strong> · {money(item.monto)}</span>)}
              {!summary?.pagos_por_estado?.length ? <span>Sin pagos registrados</span> : null}
            </div>
          </section>
        </div>

        <section className="dashPanel adminTablePanel">
          <div className="sectionTitleRow"><div><span className="sectionKicker">Actividad</span><h2>Eventos recientes</h2></div><Link href="/admin/bitacora">Ver bitácora</Link></div>
          <div className="adminTable compact">
            {(summary?.actividad_reciente ?? []).map((item) => (
              <article className="adminTableRow auditRow" key={item.id}>
                <div><strong>{item.tipo_evento}</strong><span>{item.entidad} #{item.entidad_id ?? "-"} · {item.detalle}</span></div>
                <span>{item.creado_en}</span>
              </article>
            ))}
            {!summary?.actividad_reciente?.length ? <p className="mutedPanelText">Aún no hay actividad registrada.</p> : null}
          </div>
        </section>

        <section className="adminModuleGrid">
          <Link href="/admin/publicaciones"><ClipboardList /><strong>Publicaciones</strong><span>Aprobar, rechazar y controlar visibilidad del marketplace.</span></Link>
          <Link href="/admin/quejas"><AlertTriangle /><strong>Quejas</strong><span>Atender reportes de clientes y prestadores.</span></Link>
          <Link href="/admin/usuarios"><UsersRound /><strong>Usuarios</strong><span>Consultar clientes, prestadores y estado de cuentas.</span></Link>
          <Link href="/admin/solicitudes"><BriefcaseBusiness /><strong>Solicitudes</strong><span>Ver proceso cliente-prestador y estados de servicio.</span></Link>
          <Link href="/admin/pagos"><CreditCard /><strong>Pagos</strong><span>Consultar pagos internos, estados y servicios relacionados.</span></Link>
          <Link href="/admin/bitacora"><FileText /><strong>Bitácora</strong><span>Monitorear eventos importantes y cambios del sistema.</span></Link>
        </section>
      </section>
    </main>
  );
}
