"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CreditCard, Heart, MessageCircle, Search, ShieldCheck, Star } from "lucide-react";
import { CompactDashboardRail } from "../components/SessionNav";
import { fetchCurrentUser, listClientRequests, listConversations, listPendingPayments, type CurrentUser, type PendingPayment, type RequestItem } from "../lib/api";

function money(value: number) { return `$${value.toLocaleString("es-MX")}`; }

export default function ClientDashboardPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [conversations, setConversations] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const current = await fetchCurrentUser();
        if (!current) throw new Error("Inicia sesión para ver tu dashboard.");
        if (mounted) setUser(current);
        const [requestItems, paymentItems, conversationItems] = await Promise.all([
          listClientRequests().catch(() => []),
          listPendingPayments().catch(() => []),
          listConversations().catch(() => [])
        ]);
        if (!mounted) return;
        setRequests(requestItems);
        setPayments(paymentItems);
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

  const totalPending = useMemo(() => payments.reduce((sum, payment) => sum + Number(payment.precio || 0), 0), [payments]);
  const activeRequests = requests.filter((item) => ["pendiente", "aceptada"].includes(item.estado));

  return (
    <main className="dashboardV2">
      <CompactDashboardRail role="cliente" />
      <section className="dashboardCanvas">
        <div className="dashboardHeroCard clientHero">
          <span className="sectionKicker">Dashboard cliente</span>
          <h1>{user ? `Hola, ${user.nombres}.` : "Tu centro de contratación."}</h1>
          <p>Servicios activos, mensajes y pagos reales de tu cuenta JobNest.</p>
          <Link href="/buscar" className="primaryButton"><Search size={18} /> Buscar profesional</Link>
        </div>
        {message ? <div className="formAlert moduleAlert">{message}</div> : null}
        {loading ? <div className="portfolioEmpty"><Search size={30} /><h3>Cargando dashboard...</h3></div> : null}
        <div className="metricGrid">
          <article><CalendarCheck /><strong>{activeRequests.length}</strong><span>Servicios activos</span></article>
          <article><Heart /><strong>{requests.length}</strong><span>Solicitudes totales</span></article>
          <article><MessageCircle /><strong>{conversations}</strong><span>Conversaciones</span></article>
          <article><CreditCard /><strong>{money(totalPending)}</strong><span>Pagos pendientes</span></article>
        </div>
        <div className="dashboardColumns">
          <section className="dashPanel"><h2>Servicios solicitados</h2>{requests.slice(0, 5).map((item) => <div className="dashRow" key={item.id}><ShieldCheck /> <span>{item.titulo_publicacion} · {item.estado}</span><Link href="/solicitudes">Ver</Link></div>)}{!requests.length ? <p className="mutedPanelText">Aún no tienes solicitudes.</p> : null}</section>
          <section className="dashPanel"><h2>Pagos pendientes</h2>{payments.slice(0, 5).map((item) => <div className="dashRow" key={item.id}><Star /> <span>{item.titulo} · {money(item.precio)}</span><Link href="/pagos">Pagar</Link></div>)}{!payments.length ? <p className="mutedPanelText">No hay pagos pendientes.</p> : null}</section>
        </div>
      </section>
    </main>
  );
}
