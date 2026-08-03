"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { AdminAlert, AdminBadge, AdminButton, AdminCard, AdminEmptyState, AdminPageHeader, AdminSearch, AdminSectionTitle, AdminSelect, AdminShell, AdminSkeleton, AdminToolbar, formatAdminDate, humanizeAdminText, statusTone } from "../components/AdminUI";
import { fetchCurrentUser, listAdminComplaints, resolveAdminComplaint, type AdminComplaint } from "../../lib/api";

export default function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState<AdminComplaint[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("todos");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const current = await fetchCurrentUser();
      if (!current || current.tipo_usuario !== "administrador") throw new Error("Acceso reservado para administradores.");
      setComplaints(await listAdminComplaints());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No pudimos cargar la información. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return complaints.filter((item) => {
      const matchesTerm = !term || `${item.motivo} ${item.descripcion} ${item.usuario_nombre} ${item.usuario_email}`.toLowerCase().includes(term);
      const matchesStatus = status === "todos" || item.estado === status;
      return matchesTerm && matchesStatus;
    });
  }, [complaints, query, status]);

  const updateComplaint = async (id: number, estado: "en_revision" | "resuelta") => {
    if (estado === "resuelta" && !reply.trim()) {
      setMessage("Agrega una respuesta antes de resolver la queja.");
      return;
    }
    setWorkingId(`${id}-${estado}`);
    setMessage("");
    try {
      const result = await resolveAdminComplaint(id, { estado, respuesta: reply });
      setMessage(result.message || "Queja actualizada.");
      setReply("");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No pudimos completar la acción. Inténtalo nuevamente.");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <AdminShell title="Quejas" description="Bandeja de reportes y atención administrativa.">
      <AdminPageHeader eyebrow="Atención" title="Seguimiento de quejas" description="Prioriza reportes de clientes y prestadores, registra respuesta y marca resolución." icon={AlertTriangle} />
      {message ? <AdminAlert tone={message.includes("actualizada") ? "success" : "danger"}>{message}</AdminAlert> : null}
      {loading ? <AdminSkeleton rows={5} /> : (
        <AdminCard>
          <AdminSectionTitle eyebrow="Bandeja" title={`${filtered.length} quejas`} />
          <AdminToolbar>
            <AdminSearch value={query} onChange={setQuery} placeholder="Buscar por motivo, usuario o descripción" />
            <AdminSelect value={status} onChange={setStatus} label="Estado">
              <option value="todos">Todas</option>
              <option value="pendiente">Pendientes</option>
              <option value="en_revision">En revisión</option>
              <option value="resuelta">Resueltas</option>
            </AdminSelect>
          </AdminToolbar>
          <textarea className="adminReviewNote" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Respuesta o acción tomada por administración" aria-label="Respuesta administrativa" />
          <div className="adminList">
            {filtered.map((item) => (
              <article className="adminRow" key={item.id}>
                <div className="adminRowMain">
                  <strong>{item.motivo}</strong>
                  <span>{item.usuario_nombre} · {humanizeAdminText(item.tipo_usuario)} · {formatAdminDate(item.creado_en, true)}</span>
                  <span>{item.descripcion}</span>
                  {item.solicitud_id || item.publicacion_id ? <span>Relacionado: {item.solicitud_id ? `Solicitud #${item.solicitud_id}` : ""} {item.publicacion_id ? `Publicación #${item.publicacion_id}` : ""}</span> : null}
                </div>
                <AdminBadge tone={statusTone(item.estado)}>{humanizeAdminText(item.estado)}</AdminBadge>
                <AdminButton type="button" onClick={() => void updateComplaint(item.id, "en_revision")} disabled={workingId === `${item.id}-en_revision`}>Revisar</AdminButton>
                <AdminButton type="button" tone="success" onClick={() => void updateComplaint(item.id, "resuelta")} disabled={workingId === `${item.id}-resuelta`}>Resolver</AdminButton>
              </article>
            ))}
            {!filtered.length ? <AdminEmptyState icon={Search} title="No hay quejas pendientes" description="Los reportes de clientes o prestadores aparecerán aquí para seguimiento." /> : null}
          </div>
        </AdminCard>
      )}
    </AdminShell>
  );
}
