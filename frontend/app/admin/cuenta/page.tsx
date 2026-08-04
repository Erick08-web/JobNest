"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { KeyRound, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { AdminAlert, AdminBadge, AdminButton, AdminCard, AdminEmptyState, AdminPageHeader, AdminSectionTitle, AdminShell, AdminSkeleton, formatAdminDate } from "../components/AdminUI";
import { fetchCurrentUser, logoutUser, type CurrentUser } from "../../lib/api";

export default function AdminAccountPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const current = await fetchCurrentUser();
        if (!current || current.tipo_usuario !== "administrador") throw new Error("Acceso reservado para administradores.");
        if (mounted) setUser(current);
      } catch (err) {
        if (mounted) setMessage(err instanceof Error ? err.message : "No pudimos cargar la información. Inténtalo nuevamente.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const handleLogout = async () => {
    if (!window.confirm("¿Deseas cerrar la sesión administrativa?")) return;
    await logoutUser();
    window.location.href = "/login";
  };

  return (
    <AdminShell title="Cuenta" description="Perfil y acceso del administrador." userName={user?.nombres}>
      <AdminPageHeader eyebrow="Seguridad" title="Cuenta administrativa" description="Consulta tu identidad de acceso y utiliza los flujos existentes para gestionar la sesión." icon={UserRound} />
      {message ? <AdminAlert>{message}</AdminAlert> : null}
      {loading ? <AdminSkeleton rows={3} /> : null}
      {!loading && !user ? <AdminEmptyState icon={ShieldCheck} title="No hay sesión administrativa" description="Inicia sesión con una cuenta administradora para ver esta sección." action={<Link className="adminButton primary" href="/login">Iniciar sesión</Link>} /> : null}
      {user ? (
        <section className="adminGrid two">
          <AdminCard>
            <AdminSectionTitle eyebrow="Perfil" title="Identidad" />
            <div className="adminProviderCard">
              <span className="adminAvatar"><span>{user.nombres?.slice(0, 2).toUpperCase() || "AD"}</span></span>
              <div>
                <strong>{user.nombres} {user.apellido_paterno} {user.apellido_materno}</strong>
                <p className="adminMetaText">{user.correo}</p>
              </div>
              <AdminBadge tone="info">Administrador</AdminBadge>
            </div>
            <div className="adminStateList">
              <AdminBadge tone="success">Cuenta activa</AdminBadge>
              <AdminBadge>Última revisión: {formatAdminDate(new Date().toISOString(), true)}</AdminBadge>
            </div>
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle eyebrow="Acceso" title="Seguridad de sesión" />
            <div className="adminTimeline">
              <article className="adminTimelineItem">
                <span><KeyRound size={16} /></span>
                <div>
                  <strong>Contraseña protegida</strong>
                  <p>La plataforma gestiona el acceso de forma segura. No se muestran datos sensibles en esta pantalla.</p>
                </div>
              </article>
              <article className="adminTimelineItem">
                <span><ShieldCheck size={16} /></span>
                <div>
                  <strong>Permisos administrativos</strong>
                  <p>Esta cuenta puede acceder al panel de control y a los módulos de seguimiento.</p>
                </div>
              </article>
            </div>
            <div className="adminActionBar">
              <Link className="adminButton" href="/cuenta">Ver cuenta general</Link>
              <AdminButton type="button" tone="danger" onClick={() => void handleLogout()}><LogOut size={16} /> Cerrar sesión</AdminButton>
            </div>
          </AdminCard>
        </section>
      ) : null}
    </AdminShell>
  );
}
