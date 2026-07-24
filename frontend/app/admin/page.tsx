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
          <article><UsersRound /><strong>{summary?.usuarios ?? 0}</strong><span>Usuarios totales</span></article>
          <article><CreditCard /><strong>{money(summary?.pagos_total ?? 0)}</strong><span>Pagos registrados</span></article>
        </div>

        <section className="adminStatusStrip">
          <article><BadgeCheck /><strong>{summary?.publicaciones_activas ?? 0}</strong><span>publicaciones activas</span></article>
          <article><XCircle /><strong>{summary?.publicaciones_rechazadas ?? 0}</strong><span>rechazadas</span></article>
          <article><BriefcaseBusiness /><strong>{summary?.prestadores ?? 0}</strong><span>prestadores</span></article>
          <article><ShieldCheck /><strong>{summary?.usuarios_activos ?? 0}</strong><span>usuarios activos</span></article>
        </section>

        <section className="adminModuleGrid">
          <Link href="/admin/publicaciones"><ClipboardList /><strong>Publicaciones</strong><span>Aprobar, rechazar y controlar visibilidad del marketplace.</span></Link>
          <Link href="/admin/quejas"><AlertTriangle /><strong>Quejas</strong><span>Atender reportes de clientes y prestadores.</span></Link>
          <Link href="/admin/usuarios"><UsersRound /><strong>Usuarios</strong><span>Consultar clientes, prestadores y estado de cuentas.</span></Link>
          <Link href="/admin/solicitudes"><BriefcaseBusiness /><strong>Solicitudes</strong><span>Ver proceso cliente-prestador y estados de servicio.</span></Link>
          <Link href="/admin/bitacora"><FileText /><strong>Bitácora</strong><span>Monitorear eventos importantes y cambios del sistema.</span></Link>
        </section>
      </section>
    </main>
  );
}
