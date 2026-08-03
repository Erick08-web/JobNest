"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Search } from "lucide-react";
import { AdminAlert, AdminBadge, AdminCard, AdminEmptyState, AdminPageHeader, AdminSearch, AdminSectionTitle, AdminSelect, AdminShell, AdminSkeleton, AdminToolbar, formatAdminDate, formatAdminMoney, humanizeAdminText, statusTone } from "../components/AdminUI";
import { fetchCurrentUser, getAdminSummary, listAdminRequests, type AdminRequest, type AdminSummary } from "../../lib/api";

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("todos");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const current = await fetchCurrentUser();
        if (!current || current.tipo_usuario !== "administrador") throw new Error("Acceso reservado para administradores.");
        const [requestItems, summaryData] = await Promise.all([listAdminRequests(), getAdminSummary()]);
        if (!mounted) return;
        setRequests(requestItems);
        setSummary(summaryData);
      } catch (err) {
        if (mounted) setMessage(err instanceof Error ? err.message : "No pudimos cargar la información. Inténtalo nuevamente.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return requests.filter((item) => {
      const matchesTerm = !term || `${item.titulo_publicacion} ${item.cliente_nombre} ${item.prestador_nombre} ${item.estado}`.toLowerCase().includes(term);
      const matchesStatus = status === "todos" || item.estado === status;
      return matchesTerm && matchesStatus;
    });
  }, [query, requests, status]);

  const statuses = Array.from(new Set(requests.map((item) => item.estado).filter(Boolean)));

  return (
    <AdminShell title="Solicitudes" description="Seguimiento del proceso cliente-prestador.">
      <AdminPageHeader eyebrow="Servicios" title="Solicitudes de servicio" description="Visualiza cliente, prestador, servicio, estado y fecha sin alterar el flujo operativo." icon={BriefcaseBusiness} />
      {message ? <AdminAlert>{message}</AdminAlert> : null}
      {loading ? <AdminSkeleton rows={5} /> : (
        <>
          <AdminCard>
            <AdminSectionTitle eyebrow="Estados" title="Resumen de solicitudes" />
            <div className="adminStateList">
              {(summary?.solicitudes_por_estado ?? []).map((item) => <AdminBadge tone={statusTone(item.estado)} key={item.estado}>{humanizeAdminText(item.estado)}: {item.total}</AdminBadge>)}
              {!summary?.solicitudes_por_estado?.length ? <AdminBadge>Sin estados registrados</AdminBadge> : null}
            </div>
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle eyebrow="Proceso" title={`${filtered.length} solicitudes`} />
            <AdminToolbar>
              <AdminSearch value={query} onChange={setQuery} placeholder="Buscar por servicio, cliente o prestador" />
              <AdminSelect value={status} onChange={setStatus} label="Estado">
                <option value="todos">Todos</option>
                {statuses.map((item) => <option value={item} key={item}>{humanizeAdminText(item)}</option>)}
              </AdminSelect>
            </AdminToolbar>
            <div className="adminList">
              {filtered.map((item) => (
                <article className="adminRow" key={item.id}>
                  <div className="adminRowMain">
                    <strong>{item.titulo_publicacion || "Servicio sin título"}</strong>
                    <span>{item.cliente_nombre || "Cliente"} → {item.prestador_nombre || "Prestador"}</span>
                    <span>{item.precio ? formatAdminMoney(item.precio) : "Sin precio"} · Servicio: {item.fecha_servicio ? formatAdminDate(item.fecha_servicio, true) : "Sin fecha programada"} · Solicitud: {formatAdminDate(item.fecha_solicitud, true)}</span>
                  </div>
                  <AdminBadge tone={statusTone(item.estado)}>{humanizeAdminText(item.estado)}</AdminBadge>
                </article>
              ))}
              {!filtered.length ? <AdminEmptyState icon={Search} title="No hay solicitudes" description="Cuando existan servicios solicitados, aparecerán aquí con su estado y relación cliente-prestador." /> : null}
            </div>
          </AdminCard>
        </>
      )}
    </AdminShell>
  );
}
