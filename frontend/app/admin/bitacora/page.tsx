"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Search } from "lucide-react";
import { CompactDashboardRail } from "../../components/SessionNav";
import { fetchCurrentUser, listAdminAuditEvents, type AdminAuditEvent } from "../../lib/api";

export default function AdminAuditPage() {
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
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
        if (mounted) setMessage(err instanceof Error ? err.message : "No fue posible cargar la bitácora.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  return (
    <main className="dashboardV2 adminDashboard">
      <CompactDashboardRail role="administrador" />
      <section className="dashboardCanvas">
        <header className="adminSectionHeader">
          <div><span className="sectionKicker"><FileText size={16} /> Monitoreo</span><h1>Bitácora</h1><p>Eventos importantes del sistema: revisiones, quejas, cambios de perfil y acciones administrativas.</p></div>
          <Link href="/admin">Resumen</Link>
        </header>

        {message ? <div className="formAlert moduleAlert">{message}</div> : null}
        {loading ? <div className="portfolioEmpty"><Search size={30} /><h3>Cargando bitácora...</h3></div> : null}

        <section className="dashPanel adminTablePanel">
          <div className="sectionTitleRow"><div><span className="sectionKicker">Trazabilidad</span><h2>Eventos monitoreados</h2></div></div>
          <div className="adminTable compact">
            {events.map((item) => (
              <article className="adminTableRow auditRow" key={item.id}>
                <div><strong>{item.tipo_evento}</strong><span>{item.entidad} #{item.entidad_id ?? "-"} · {item.detalle}</span></div>
                <span>{item.creado_en}</span>
              </article>
            ))}
            {!events.length ? <p className="mutedPanelText">Aún no hay eventos registrados.</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
