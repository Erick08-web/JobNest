"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, BriefcaseBusiness, ClipboardList, CreditCard, FileText, Image as ImageIcon, Mail, ShieldCheck, Star, UserRound } from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminCard,
  AdminEmptyState,
  AdminPageHeader,
  AdminSectionTitle,
  AdminShell,
  AdminSkeleton,
  AdminStatCard,
  formatAdminDate,
  formatAdminMoney,
  humanizeAdminText,
  statusTone
} from "../../components/AdminUI";
import { fetchCurrentUser, getAdminUserDetail, type AdminUserDetail } from "../../../lib/api";

function assetUrl(value?: string | null) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith("/api/backend") ? value : `/api/backend${value.startsWith("/") ? value : `/${value}`}`;
}

function initials(name?: string) {
  return (name || "Usuario JobNest").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "US";
}

function EmptyMini({ text }: { text: string }) {
  return <p className="adminMetaText">{text}</p>;
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const current = await fetchCurrentUser();
      if (!current || current.tipo_usuario !== "administrador") throw new Error("Acceso reservado para administradores.");
      setDetail(await getAdminUserDetail(params.id));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No pudimos cargar el detalle del usuario.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [params.id]);

  const user = detail?.usuario;
  const receivedReviews = useMemo(() => detail?.resenas.filter((item) => item.tipo === "recibida") ?? [], [detail?.resenas]);
  const givenReviews = useMemo(() => detail?.resenas.filter((item) => item.tipo === "realizada") ?? [], [detail?.resenas]);

  return (
    <AdminShell title="Detalle de usuario" description="Consulta operación, actividad y señales de control sin exponer datos sensibles." userName={user?.nombre}>
      <AdminPageHeader
        eyebrow="Usuarios"
        title={user?.nombre || "Detalle de cuenta"}
        description="Resumen administrativo del usuario seleccionado."
        icon={UserRound}
        actions={<Link className="adminButton" href="/admin/usuarios"><ArrowLeft size={16} /> Volver a usuarios</Link>}
      />
      {message ? <AdminAlert>{message}</AdminAlert> : null}
      {loading ? <AdminSkeleton rows={6} /> : null}
      {!loading && !detail ? <AdminEmptyState icon={ShieldCheck} title="No se encontró información" description="Verifica el usuario seleccionado o regresa al directorio." /> : null}
      {detail && user ? (
        <div className="adminUserDetail">
          <AdminCard>
            <div className="adminUserHero">
              <span className="adminUserAvatar">
                {user.foto_perfil ? <img src={assetUrl(user.foto_perfil)} alt={`Foto de ${user.nombre}`} /> : <strong>{initials(user.nombre)}</strong>}
              </span>
              <div>
                <span className="sectionKicker">Resumen</span>
                <h2>{user.nombre}</h2>
                <p><Mail size={16} /> {user.email}</p>
                <div className="adminStateList">
                  <AdminBadge tone={statusTone(user.tipo_usuario)}>{humanizeAdminText(user.tipo_usuario)}</AdminBadge>
                  <AdminBadge tone={statusTone(user.activo)}>{user.activo ? "Activo" : "Inactivo"}</AdminBadge>
                  {user.prestador ? <AdminBadge tone={user.prestador.verificado ? "success" : "warning"}>{user.prestador.verificado ? "Prestador verificado" : "Prestador sin verificar"}</AdminBadge> : null}
                </div>
              </div>
            </div>
            <div className="adminDetailGrid">
              <p><strong>Teléfono</strong><span>{user.telefono || "No registrado"}</span></p>
              <p><strong>Registro</strong><span>{formatAdminDate(user.creado_en, true)}</span></p>
              <p><strong>Último acceso</strong><span>{user.ultimo_login ? formatAdminDate(user.ultimo_login, true) : "Sin acceso reciente"}</span></p>
              <p><strong>Roles</strong><span>{user.roles?.length ? user.roles.join(", ") : humanizeAdminText(user.tipo_usuario)}</span></p>
            </div>
          </AdminCard>

          <section className="adminGrid four">
            <AdminStatCard icon={BriefcaseBusiness} label="Publicaciones" value={detail.resumen.publicaciones} />
            <AdminStatCard icon={ClipboardList} label="Solicitudes" value={detail.resumen.solicitudes_cliente + detail.resumen.solicitudes_prestador} context={`${detail.resumen.solicitudes_cliente} cliente · ${detail.resumen.solicitudes_prestador} prestador`} />
            <AdminStatCard icon={CreditCard} label="Pagos" value={detail.resumen.pagos} />
            <AdminStatCard icon={Star} label="Reseñas" value={detail.resumen.resenas_recibidas + detail.resumen.resenas_realizadas} context={`${detail.resumen.resenas_recibidas} recibidas · ${detail.resumen.resenas_realizadas} realizadas`} />
          </section>

          <section className="adminGrid two">
            <AdminCard>
              <AdminSectionTitle eyebrow="Publicaciones" title="Servicios publicados" />
              <div className="adminMiniList">
                {detail.publicaciones.map((item) => (
                  <article key={item.id}>
                    <strong>{item.titulo}</strong>
                    <span>{item.categoria} · {formatAdminMoney(item.precio)} · {formatAdminDate(item.fecha_creacion, true)}</span>
                    <AdminBadge tone={statusTone(item.estado_revision)}>{humanizeAdminText(item.estado_revision)}</AdminBadge>
                  </article>
                ))}
                {!detail.publicaciones.length ? <EmptyMini text="Sin publicaciones registradas." /> : null}
              </div>
            </AdminCard>

            <AdminCard>
              <AdminSectionTitle eyebrow="Solicitudes" title="Actividad como cliente/prestador" />
              <div className="adminMiniList">
                {detail.solicitudes.map((item) => (
                  <article key={item.id}>
                    <strong>{item.titulo_publicacion}</strong>
                    <span>{humanizeAdminText(item.rol_en_solicitud)} · {formatAdminDate(item.fecha_solicitud, true)} · Servicio: {item.fecha_servicio || "Sin fecha"}</span>
                    <AdminBadge tone={statusTone(item.estado)}>{humanizeAdminText(item.estado)}</AdminBadge>
                  </article>
                ))}
                {!detail.solicitudes.length ? <EmptyMini text="Sin solicitudes relacionadas." /> : null}
              </div>
            </AdminCard>

            <AdminCard>
              <AdminSectionTitle eyebrow="Pagos" title="Pagos relacionados" />
              <div className="adminMiniList">
                {detail.pagos.map((item) => (
                  <article key={item.id}>
                    <strong>{formatAdminMoney(item.monto)}</strong>
                    <span>{item.titulo_publicacion} · {item.metodo} · {formatAdminDate(item.creado_en, true)}</span>
                    <AdminBadge tone={statusTone(item.estado)}>{humanizeAdminText(item.estado)}</AdminBadge>
                  </article>
                ))}
                {!detail.pagos.length ? <EmptyMini text="Sin pagos relacionados." /> : null}
              </div>
            </AdminCard>

            <AdminCard>
              <AdminSectionTitle eyebrow="Reseñas" title="Recibidas y realizadas" />
              <div className="adminMiniList">
                {[...receivedReviews, ...givenReviews].map((item) => (
                  <article key={item.id}>
                    <strong>{item.calificacion ?? "-"} estrellas · {humanizeAdminText(item.tipo)}</strong>
                    <span>{item.titulo_publicacion || "Servicio"} · {formatAdminDate(item.creado_en, true)}</span>
                    {item.comentario ? <p>{item.comentario}</p> : null}
                  </article>
                ))}
                {!detail.resenas.length ? <EmptyMini text="Sin reseñas relacionadas." /> : null}
              </div>
            </AdminCard>

            <AdminCard>
              <AdminSectionTitle eyebrow="Portafolio" title="Trabajos del prestador" />
              <div className="adminMiniList">
                {detail.portafolio.map((item) => (
                  <article key={item.id}>
                    <strong>{item.titulo}</strong>
                    <span>{item.publicacion_titulo || "Trabajo"} · {formatAdminDate(item.creado_en, true)}</span>
                    {item.imagen_url ? <span><ImageIcon size={14} /> Imagen disponible</span> : null}
                  </article>
                ))}
                {!detail.portafolio.length ? <EmptyMini text="Sin portafolio registrado." /> : null}
              </div>
            </AdminCard>

            <AdminCard>
              <AdminSectionTitle eyebrow="Seguridad y moderación" title="Quejas y eventos" />
              <div className="adminMiniList">
                {detail.quejas.map((item) => (
                  <article key={`q-${item.id}`}>
                    <strong>Queja: {item.motivo}</strong>
                    <span>{formatAdminDate(item.creado_en, true)}</span>
                    <AdminBadge tone={statusTone(item.estado)}>{humanizeAdminText(item.estado)}</AdminBadge>
                  </article>
                ))}
                {detail.eventos.slice(0, 8).map((item) => (
                  <article key={`e-${item.id}`}>
                    <strong>{humanizeAdminText(item.tipo_evento)}</strong>
                    <span>{item.entidad}{item.entidad_id ? ` #${item.entidad_id}` : ""} · {formatAdminDate(item.creado_en, true)}</span>
                    {item.detalle ? <p>{item.detalle}</p> : null}
                  </article>
                ))}
                {!detail.quejas.length && !detail.eventos.length ? <EmptyMini text="Sin eventos administrativos relacionados." /> : null}
              </div>
            </AdminCard>
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
