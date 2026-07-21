"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Clock3, MapPin, Search, ShieldCheck } from "lucide-react";
import { fetchCurrentUser, listAgendaEvents, type AgendaEvent, type CurrentUser } from "../lib/api";

function formatDate(value: string) {
  if (!value) return "Fecha pendiente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

function formatTime(value: string) {
  if (!value) return "Todo el día";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Todo el día";
  return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export default function AgendaPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const current = await fetchCurrentUser();
        if (!current) throw new Error("Inicia sesión para ver tu agenda.");
        if (mounted) setUser(current);
        if (current.tipo_usuario !== "prestador") {
          throw new Error("La agenda está disponible para cuentas de prestador.");
        }
        const items = await listAgendaEvents();
        if (mounted) setEvents(items);
      } catch (err) {
        if (mounted) setMessage(err instanceof Error ? err.message : "No fue posible cargar la agenda.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const nextEvent = events[0];
  const grouped = useMemo(() => {
    const groups = new Map<string, AgendaEvent[]>();
    events.forEach((event) => {
      const key = formatDate(event.start);
      groups.set(key, [...(groups.get(key) ?? []), event]);
    });
    return [...groups.entries()];
  }, [events]);

  return (
    <main className="modulePage agendaRealPage">
      <Link href="/profesional" className="backLink"><ArrowLeft size={18} /> Volver</Link>
      <section className="moduleHero agendaHero">
        <span className="sectionKicker">Agenda real</span>
        <h1>{user ? `${user.nombres}, estos son tus próximos servicios.` : "Agenda profesional"}</h1>
        <p>Trabajos aceptados desde solicitudes reales, organizados por fecha y hora.</p>
      </section>

      <section className="agendaOverview">
        <article><CalendarDays /><strong>{events.length}</strong><span>Eventos programados</span></article>
        <article><Clock3 /><strong>{nextEvent ? formatTime(nextEvent.start) : "-"}</strong><span>Siguiente horario</span></article>
        <article><ShieldCheck /><strong>{nextEvent ? "Activo" : "Libre"}</strong><span>Estado de agenda</span></article>
      </section>

      {message ? <div className="formAlert moduleAlert agendaAlert">{message}</div> : null}
      {loading ? <section className="emptyResults"><Search size={34} /><h3>Cargando agenda...</h3></section> : null}
      {!loading && !events.length && !message ? <section className="emptyResults"><CalendarDays size={34} /><h3>No tienes servicios aceptados en agenda</h3><p>Cuando aceptes una solicitud con fecha aparecerá aquí.</p><Link href="/solicitudes">Revisar solicitudes</Link></section> : null}

      <section className="agendaTimeline">
        {grouped.map(([date, items]) => (
          <article className="agendaDay" key={date}>
            <header><span>{date}</span><strong>{items.length} servicio{items.length === 1 ? "" : "s"}</strong></header>
            <div>
              {items.map((event) => (
                <section className="agendaEvent" key={event.id}>
                  <span className="agendaTime">{formatTime(event.start)}</span>
                  <div>
                    <strong>{event.title}</strong>
                    <p>{String(event.extendedProps?.cliente_nombre ?? "Cliente JobNest")}</p>
                    <small><MapPin size={14} /> {String(event.extendedProps?.servicio ?? "Servicio")}</small>
                  </div>
                  <Link href="/solicitudes">Ver solicitud</Link>
                </section>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
