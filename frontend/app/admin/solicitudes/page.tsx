"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, Search } from "lucide-react";
import { CompactDashboardRail } from "../../components/SessionNav";
import { fetchCurrentUser, getAdminSummary, listAdminRequests, type AdminRequest, type AdminSummary } from "../../lib/api";

function money(value: number) {
  return `$${value.toLocaleString("es-MX")}`;
}

function statusClass(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
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
        if (mounted) setMessage(err instanceof Error ? err.message : "No fue posible cargar solicitudes.");
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
          <div><span className="sectionKicker"><BriefcaseBusiness size={16} /> Servicios</span><h1>Solicitudes</h1><p>Seguimiento de cliente, prestador, estado del servicio y precio relacionado.</p></div>
          <Link href="/admin">Resumen</Link>
        </header>

        {message ? <div className="formAlert moduleAlert">{message}</div> : null}
        {loading ? <div className="portfolioEmpty"><Search size={30} /><h3>Cargando solicitudes...</h3></div> : null}

        <section className="dashPanel adminTablePanel">
          <div className="sectionTitleRow"><div><span className="sectionKicker">Proceso</span><h2>Actividad de servicios</h2></div></div>
          <div className="adminStateList">
            {(summary?.solicitudes_por_estado ?? []).map((item) => <span key={item.estado}>{item.estado}: <strong>{item.total}</strong></span>)}
          </div>
          <div className="adminTable compact adminSpacedTable">
            {requests.map((item) => (
              <article className="adminTableRow requestRow" key={item.id}>
                <div><strong>{item.titulo_publicacion}</strong><span>{item.cliente_nombre || "Cliente"} a {item.prestador_nombre || "Prestador"} · {item.precio ? money(item.precio) : "Sin precio"}</span></div>
                <span className={`statusPill ${statusClass(item.estado)}`}>{item.estado}</span>
                <span>{item.fecha_servicio || item.fecha_solicitud}</span>
              </article>
            ))}
            {!requests.length ? <p className="mutedPanelText">Aún no hay solicitudes.</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
