"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, FileText, Search } from "lucide-react";
import { AdminAlert, AdminBadge, AdminCard, AdminEmptyState, AdminPageHeader, AdminSearch, AdminSectionTitle, AdminSelect, AdminShell, AdminSkeleton, AdminToolbar, formatAdminDate, humanizeAdminText, statusTone } from "../components/AdminUI";
import { fetchCurrentUser, listAdminAuditEvents, type AdminAuditEvent } from "../../lib/api";

export default function AdminAuditPage() {
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("todas");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const current = await fetchCurrentUser();
        if (!current || current.tipo_usuario !== "administrador") throw new Error("Acceso reservado para administradores.");
        const items = await listAdminAuditEvents();
        if (mounted) setEvents(items);
      } catch (err) {
        if (mounted) setMessage(err instanceof Error ? err.message : "No pudimos cargar la información. Inténtalo nuevamente.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const entities = Array.from(new Set(events.map((item) => item.entidad).filter(Boolean)));
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return events.filter((item) => {
      const matchesTerm = !term || `${item.tipo_evento} ${item.entidad} ${item.detalle} ${item.actor_email} ${item.usuario_email}`.toLowerCase().includes(term);
      const matchesEntity = entity === "todas" || item.entidad === entity;
      return matchesTerm && matchesEntity;
    });
  }, [entity, events, query]);

  return (
    <AdminShell title="Bitácora" description="Trazabilidad de eventos administrativos.">
      <AdminPageHeader eyebrow="Monitoreo" title="Bitácora de actividad" description="Eventos importantes explicados en lenguaje operativo, conservando trazabilidad para revisión." icon={FileText} />
      {message ? <AdminAlert>{message}</AdminAlert> : null}
      {loading ? <AdminSkeleton rows={6} /> : (
        <AdminCard>
          <AdminSectionTitle eyebrow="Eventos" title={`${filtered.length} registros`} />
          <AdminToolbar>
            <AdminSearch value={query} onChange={setQuery} placeholder="Buscar por acción, entidad o usuario" />
            <AdminSelect value={entity} onChange={setEntity} label="Entidad">
              <option value="todas">Todas</option>
              {entities.map((item) => <option value={item} key={item}>{humanizeAdminText(item)}</option>)}
            </AdminSelect>
          </AdminToolbar>
          <div className="adminTimeline">
            {filtered.map((item) => (
              <article className="adminTimelineItem" key={item.id}>
                <span><Activity size={16} /></span>
                <div>
                  <strong>{humanizeAdminText(item.tipo_evento)}</strong>
                  <p>{humanizeAdminText(item.entidad)} {item.entidad_id ? `#${item.entidad_id}` : ""} · {item.detalle || "Evento registrado"}</p>
                  <p>{formatAdminDate(item.creado_en, true)} · Actor: {item.actor_email || "Sistema"} · Usuario: {item.usuario_email || "No aplica"}</p>
                  <AdminBadge tone={statusTone(item.tipo_evento)}>{humanizeAdminText(item.entidad)}</AdminBadge>
                </div>
              </article>
            ))}
            {!filtered.length ? <AdminEmptyState icon={Search} title="No hay eventos registrados" description="Cuando existan acciones administrativas, aparecerán en esta línea de tiempo." /> : null}
          </div>
        </AdminCard>
      )}
    </AdminShell>
  );
}
