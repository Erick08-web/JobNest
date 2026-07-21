"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, BriefcaseBusiness, CalendarDays, Image, MessageCircle, Search, Star, WalletCards } from "lucide-react";
import { CompactDashboardRail } from "../components/SessionNav";
import { fetchCurrentUser, listAgendaEvents, listConversations, listProviderRequests, type AgendaEvent, type CurrentUser, type RequestItem } from "../lib/api";

function money(value: number) { return `$${value.toLocaleString("es-MX")}`; }

export default function ProfessionalDashboardPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [conversations, setConversations] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const current = await fetchCurrentUser();
        if (!current) throw new Error("Inicia sesión para ver tu dashboard profesional.");
        if (mounted) setUser(current);
        const [requestItems, eventItems, conversationItems] = await Promise.all([
          listProviderRequests().catch(() => []),
          listAgendaEvents().catch(() => []),
          listConversations().catch(() => [])
        ]);
        if (!mounted) return;
        setRequests(requestItems);
        setEvents(eventItems);
        setConversations(conversationItems.length);
      } catch (err) {
        if (mounted) setMessage(err instanceof Error ? err.message : "No fue posible cargar tu dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const pending = requests.filter((item) => item.estado === "pendiente");
  const accepted = requests.filter((item) => item.estado === "aceptada");
  const estimatedIncome = useMemo(() => requests.filter((item) => ["aceptada", "concluido", "concluida"].includes(item.estado)).reduce((sum, item) => sum + Number(item.precio || 0), 0), [requests]);

  return (
    <main className="dashboardV2 professionalDash">
      <CompactDashboardRail role="prestador" />
      <section className="dashboardCanvas">
        <div className="dashboardHeroCard proHero">
          <span className="sectionKicker">Dashboard profesional</span>
          <h1>{user ? `Hola, ${user.nombres}.` : "Tu operación profesional."}</h1>
          <p>Solicitudes, agenda, mensajes e ingresos estimados desde la base de datos real.</p>
          <Link href="/publicar" className="primaryButton"><CalendarDays size={18} /> Publicar servicio</Link>
        </div>
        {message ? <div className="formAlert moduleAlert">{message}</div> : null}
        {loading ? <div className="portfolioEmpty"><Search size={30} /><h3>Cargando dashboard...</h3></div> : null}
        <div className="metricGrid">
          <article><BriefcaseBusiness /><strong>{pending.length}</strong><span>Solicitudes pendientes</span></article>
          <article><WalletCards /><strong>{money(estimatedIncome)}</strong><span>Ingresos estimados</span></article>
          <article><Star /><strong>{accepted.length}</strong><span>Trabajos aceptados</span></article>
          <article><Image /><strong>{events.length}</strong><span>Eventos en agenda</span></article>
        </div>
        <div className="dashboardColumns">
          <section className="dashPanel"><h2>Solicitudes prioritarias</h2>{requests.slice(0, 5).map((item) => <div className="dashRow" key={item.id}><MessageCircle /> <span>{item.cliente_nombre || "Cliente"} · {item.titulo_publicacion}</span><Link href="/solicitudes">Responder</Link></div>)}{!requests.length ? <p className="mutedPanelText">Aún no tienes solicitudes.</p> : null}</section>
          <section className="dashPanel"><h2>Actividad</h2><div className="chartMock"><BarChart3 /><span>{conversations} conversaciones activas · {events.length} trabajos en agenda</span></div></section>
        </div>
      </section>
    </main>
  );
}
