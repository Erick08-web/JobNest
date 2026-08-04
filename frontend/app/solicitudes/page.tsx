"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, BriefcaseBusiness, CalendarDays, CheckCircle2, Clock3, MessageCircle, Search, XCircle } from "lucide-react";
import { cancelRequest, fetchCurrentUser, listClientRequests, listProviderRequests, listRequestHistory, markRequestDone, updateRequestStatus, type CurrentUser, type RequestHistoryEvent, type RequestItem } from "../lib/api";

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  concluido: "Concluida",
  concluida: "Concluida",
  calificado: "Calificada",
  cancelada: "Cancelada",
  cancelada_cliente: "Cancelada por cliente",
  cancelada_prestador: "Cancelada por prestador"
};

function money(value: number | null) {
  return value ? `$${value.toLocaleString("es-MX")}` : "Cotizar";
}

export default function RequestsPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [history, setHistory] = useState<Record<number, RequestHistoryEvent[]>>({});

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const current = await fetchCurrentUser();
      if (!current) throw new Error("Inicia sesión para ver tus solicitudes.");
      setUser(current);
      const items = current.tipo_usuario === "prestador" ? await listProviderRequests() : await listClientRequests();
      setRequests(items);
      const historyEntries = await Promise.all(items.map(async (item) => [item.id, await listRequestHistory(item.id).catch(() => [])] as const));
      setHistory(Object.fromEntries(historyEntries));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible cargar solicitudes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((item) => item.estado === "pendiente").length,
    accepted: requests.filter((item) => item.estado === "aceptada").length,
    done: requests.filter((item) => ["concluido", "concluida"].includes(item.estado)).length
  }), [requests]);

  const handleStatus = async (id: number, estado: "aceptada" | "rechazada") => {
    setMessage("");
    setWorkingId(id);
    try {
      const result = await updateRequestStatus(id, estado);
      setMessage(result.message || "Solicitud actualizada.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible actualizar la solicitud.");
    } finally {
      setWorkingId(null);
    }
  };

  const handleDone = async (id: number) => {
    setMessage("");
    setWorkingId(id);
    try {
      const result = await markRequestDone(id);
      setMessage(result.message || "Trabajo marcado como concluido.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible marcar como concluido.");
    } finally {
      setWorkingId(null);
    }
  };

  const handleCancel = async (id: number) => {
    const reason = cancelReason.trim();
    if (!reason) {
      setMessage("El motivo de cancelación es obligatorio.");
      return;
    }
    if (!window.confirm("¿Deseas cancelar este servicio? Esta acción puede no ser reversible.")) return;
    setMessage("");
    setWorkingId(id);
    try {
      const result = await cancelRequest(id, reason);
      setMessage(result.message || "El servicio fue cancelado correctamente.");
      setCancelingId(null);
      setCancelReason("");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No pudimos completar la acción.");
    } finally {
      setWorkingId(null);
    }
  };

  const home = user?.tipo_usuario === "prestador" ? "/profesional" : "/cliente";

  return (
    <main className="modulePage requestsRealPage">
      <Link href={home} className="backLink"><ArrowLeft size={18} /> Volver</Link>
      <section className="moduleHero requestsHero">
        <span className="sectionKicker">Solicitudes</span>
        <h1>{user?.tipo_usuario === "prestador" ? "Gestiona clientes y trabajos entrantes." : "Da seguimiento a tus servicios solicitados."}</h1>
        <p>Consulta tus solicitudes y mantén el seguimiento de cada servicio.</p>
      </section>

      <section className="requestStats">
        <article><BriefcaseBusiness /><strong>{stats.total}</strong><span>Total</span></article>
        <article><Clock3 /><strong>{stats.pending}</strong><span>Pendientes</span></article>
        <article><BadgeCheck /><strong>{stats.accepted}</strong><span>Aceptadas</span></article>
        <article><CheckCircle2 /><strong>{stats.done}</strong><span>Concluidas</span></article>
      </section>

      {message ? <div className="formAlert moduleAlert">{message}</div> : null}
      {loading ? <section className="emptyResults"><Search size={34} /><h3>Cargando solicitudes...</h3></section> : null}

      {!loading && !requests.length && !message ? (
        <section className="emptyResults"><BriefcaseBusiness size={34} /><h3>Aún no hay solicitudes</h3><p>Cuando un cliente solicite un servicio, aparecerá aquí con estado y acciones.</p><Link href="/buscar">Buscar servicios</Link></section>
      ) : null}

      <section className="moduleList requestList">
        {requests.map((request) => {
          const otherName = user?.tipo_usuario === "prestador" ? request.cliente_nombre : request.prestador_nombre;
          const requestHistory = history[request.id] ?? [];
          const canCancel = ["pendiente", "aceptada"].includes(request.estado);
          return (
            <article className="requestItem" key={request.id}>
              <div className="paymentIcon"><BriefcaseBusiness size={20} /></div>
              <div>
                <span className={`statusPill ${request.estado}`}>{statusLabels[request.estado] || request.estado}</span>
                <strong>{request.titulo_publicacion}</strong>
                <p>{otherName || "Usuario JobNest"} · {request.categoria} · {money(request.precio)}</p>
                <small><CalendarDays size={15} /> {request.fecha_servicio || "Fecha por definir"} {request.hora_servicio ? `· ${request.hora_servicio}` : ""}</small>
                {request.mensaje_cliente ? <blockquote>{request.mensaje_cliente}</blockquote> : null}
                {requestHistory.length ? (
                  <div className="requestHistory">
                    <strong>Historial</strong>
                    {requestHistory.map((event, index) => (
                      <p key={`${request.id}-${event.titulo}-${index}`}><span>{event.fecha || "Sin fecha"}</span> {event.titulo}{event.detalle ? `: ${event.detalle}` : ""}</p>
                    ))}
                  </div>
                ) : null}
                {cancelingId === request.id ? (
                  <div className="cancelBox">
                    <strong>Motivo de cancelación</strong>
                    <p>Explica brevemente por qué deseas cancelar este servicio.</p>
                    <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={500} placeholder="Escribe el motivo..." />
                    <small>{cancelReason.length}/500</small>
                    <div>
                      <button type="button" onClick={() => { setCancelingId(null); setCancelReason(""); }}>Cancelar</button>
                      <button type="button" className="dangerAction" disabled={workingId === request.id} onClick={() => void handleCancel(request.id)}>{workingId === request.id ? "Cancelando..." : "Confirmar cancelación"}</button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="requestActions">
                <Link href="/mensajes"><MessageCircle size={17} /> Mensajes</Link>
                {canCancel ? <button className="dangerAction" disabled={workingId === request.id} onClick={() => setCancelingId(request.id)}><XCircle size={17} /> Cancelar</button> : null}
                {user?.tipo_usuario === "prestador" && request.estado === "pendiente" ? <button disabled={workingId === request.id} onClick={() => void handleStatus(request.id, "aceptada")}><CheckCircle2 size={17} /> Aceptar</button> : null}
                {user?.tipo_usuario === "prestador" && request.estado === "pendiente" ? <button className="dangerAction" disabled={workingId === request.id} onClick={() => void handleStatus(request.id, "rechazada")}><XCircle size={17} /> Rechazar</button> : null}
                {user?.tipo_usuario === "prestador" && request.estado === "aceptada" ? <button disabled={workingId === request.id} onClick={() => void handleDone(request.id)}><CheckCircle2 size={17} /> Concluir</button> : null}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
