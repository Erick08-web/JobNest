"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Bell, BriefcaseBusiness, ClipboardList, CreditCard, FileText, RefreshCw, ShieldCheck, UsersRound } from "lucide-react";
import {
  AdminAlert,
  AdminButton,
  AdminCard,
  AdminEmptyState,
  AdminPageHeader,
  AdminSectionTitle,
  AdminShell,
  AdminSkeleton,
  AdminStatCard,
  AdminBadge,
  formatAdminMoney,
  formatAdminDate,
  humanizeAdminText,
  statusTone
} from "./components/AdminUI";
import { fetchCurrentUser, getAdminSummary, type AdminSummary, type CurrentUser } from "../lib/api";

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
      setMessage(err instanceof Error ? err.message : "No pudimos cargar la información. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <AdminShell title="Inicio" description="Resumen ejecutivo de la operación de JobNest." userName={user?.nombres} actions={<AdminButton onClick={() => void load()}><RefreshCw size={16} /> Actualizar</AdminButton>}>
      {message && !summary && !loading ? (
        <AdminEmptyState icon={ShieldCheck} title={message} description="El panel requiere una sesión con permisos de administrador." action={<Link className="adminButton primary" href="/login">Iniciar sesión</Link>} />
      ) : null}

      {message && summary ? <AdminAlert>{message}</AdminAlert> : null}

      <AdminPageHeader
        eyebrow="Centro de control"
        title={user ? `Hola, ${user.nombres}.` : "Administración JobNest"}
        description="Supervisa publicaciones, usuarios, solicitudes, pagos, quejas y trazabilidad desde una experiencia pensada para operación diaria."
        icon={ShieldCheck}
        actions={<Link className="adminButton" href="/admin/publicaciones"><ClipboardList size={16} /> Revisar publicaciones</Link>}
      />

      {loading ? <AdminSkeleton rows={4} /> : (
        <>
          <section className="adminGrid four" aria-label="Indicadores principales">
            <AdminStatCard icon={ClipboardList} value={summary?.publicaciones_pendientes ?? 0} label="Publicaciones por revisar" context="Cola de moderación" href="/admin/publicaciones" tone="warning" />
            <AdminStatCard icon={AlertTriangle} value={summary?.quejas_pendientes ?? 0} label="Quejas pendientes" context="Reportes por atender" href="/admin/quejas" tone="danger" />
            <AdminStatCard icon={Bell} value={summary?.alertas_pendientes ?? 0} label="Alertas sin leer" context="Avisos administrativos" tone="info" />
            <AdminStatCard icon={CreditCard} value={formatAdminMoney(summary?.pagos_total ?? 0)} label="Pagos registrados" context="Monto acumulado" href="/admin/pagos" tone="success" />
          </section>

          <section className="adminGrid four" aria-label="Estado operativo">
            <AdminStatCard icon={UsersRound} value={summary?.usuarios_activos ?? 0} label="Usuarios activos" context={`${summary?.usuarios_inactivos ?? 0} inactivos`} href="/admin/usuarios" />
            <AdminStatCard icon={BriefcaseBusiness} value={summary?.solicitudes_nuevas ?? 0} label="Solicitudes nuevas" context={`${summary?.servicios_concluidos ?? 0} servicios concluidos`} href="/admin/solicitudes" tone="info" />
            <AdminStatCard icon={ShieldCheck} value={summary?.publicaciones_activas ?? 0} label="Publicaciones activas" context={`${summary?.publicaciones_rechazadas ?? 0} rechazadas`} href="/admin/publicaciones" tone="success" />
            <AdminStatCard icon={Activity} value={summary?.mensajes ?? 0} label="Mensajes registrados" context={`${summary?.resenas ?? 0} reseñas`} />
          </section>

          <section className="adminGrid two">
            <AdminCard>
              <AdminSectionTitle eyebrow="Usuarios" title="Distribución de cuentas" action={<Link className="adminButton" href="/admin/usuarios">Ver usuarios</Link>} />
              <div className="adminStateList">
                <AdminBadge tone="success">Clientes activos: {summary?.clientes_activos ?? 0}</AdminBadge>
                <AdminBadge tone="neutral">Clientes inactivos: {summary?.clientes_inactivos ?? 0}</AdminBadge>
                <AdminBadge tone="success">Prestadores activos: {summary?.prestadores_activos ?? 0}</AdminBadge>
                <AdminBadge tone="neutral">Prestadores inactivos: {summary?.prestadores_inactivos ?? 0}</AdminBadge>
                <AdminBadge tone="warning">Validación pendiente: {summary?.prestadores_pendientes_validacion ?? 0}</AdminBadge>
                <AdminBadge tone="info">Administradores: {summary?.administradores ?? 0}</AdminBadge>
              </div>
            </AdminCard>

            <AdminCard>
              <AdminSectionTitle eyebrow="Pagos" title="Estados registrados" action={<Link className="adminButton" href="/admin/pagos">Ver pagos</Link>} />
              <div className="adminStateList">
                {(summary?.pagos_por_estado ?? []).map((item) => (
                  <AdminBadge tone={statusTone(item.estado)} key={item.estado}>{humanizeAdminText(item.estado)}: {item.total} · {formatAdminMoney(item.monto)}</AdminBadge>
                ))}
                {!summary?.pagos_por_estado?.length ? <AdminEmptyState icon={CreditCard} title="Sin pagos registrados" description="Cuando existan pagos, aparecerán agrupados por estado." /> : null}
              </div>
            </AdminCard>
          </section>

          <AdminCard>
            <AdminSectionTitle eyebrow="Actividad reciente" title="Eventos importantes" action={<Link className="adminButton" href="/admin/bitacora"><FileText size={16} /> Abrir bitácora</Link>} />
            <div className="adminTimeline">
              {(summary?.actividad_reciente ?? []).map((item) => (
                <article className="adminTimelineItem" key={item.id}>
                  <span><Activity size={16} /></span>
                  <div>
                    <strong>{humanizeAdminText(item.tipo_evento)}</strong>
                    <p>{humanizeAdminText(item.entidad)} {item.entidad_id ? `#${item.entidad_id}` : ""} · {item.detalle || "Evento registrado"} · {formatAdminDate(item.creado_en, true)}</p>
                  </div>
                </article>
              ))}
              {!summary?.actividad_reciente?.length ? <AdminEmptyState icon={FileText} title="No hay actividad reciente" description="La trazabilidad aparecerá aquí cuando haya eventos administrativos." /> : null}
            </div>
          </AdminCard>

          <section className="adminGrid three" aria-label="Accesos rápidos">
            <AdminStatCard icon={ClipboardList} value="Moderación" label="Publicaciones" context="Aprobar, rechazar, ocultar o suspender contenido" href="/admin/publicaciones" />
            <AdminStatCard icon={AlertTriangle} value="Atención" label="Quejas" context="Responder reportes de clientes y prestadores" href="/admin/quejas" tone="warning" />
            <AdminStatCard icon={BarChart3} value="Reportes" label="Analítica" context="KPIs, filtros, gráficas y exportaciones" href="/admin/analitica" tone="info" />
          </section>
        </>
      )}
    </AdminShell>
  );
}
