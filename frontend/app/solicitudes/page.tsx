"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, BriefcaseBusiness, CalendarDays, CheckCircle2, Clock3, MessageCircle, Search, XCircle } from "lucide-react";
import { fetchCurrentUser, listClientRequests, listProviderRequests, markRequestDone, updateRequestStatus, type CurrentUser, type RequestItem } from "../lib/api";

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  concluido: "Concluida",
  concluida: "Concluida"
};

function money(value: number | null) {
  return value ? `$${value.toLocaleString("es-MX")}` : "Cotizar";
}

export default function RequestsPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const current = await fetchCurrentUser();
      if (!current) throw new Error("Inicia sesión para ver tus solicitudes.");
      setUser(current);
      const items = current.tipo_usuario === "prestador" ? await listProviderRequests() : await listClientRequests();
      setRequests(items);
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
    try {
      const result = await updateRequestStatus(id, estado);
      setMessage(result.message || "Solicitud actualizada.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible actualizar la solicitud.");
    }
  };

  const handleDone = async (id: number) => {
    setMessage("");
    try {
      const result = await markRequestDone(id);
      setMessage(result.message || "Trabajo marcado como concluido.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible marcar como concluido.");
    }
  };

  const home = user?.tipo_usuario === "prestador" ? "/profesional" : "/cliente";

  return (
    <main className="modulePage requestsRealPage">
      <Link href={home} className="backLink"><ArrowLeft size={18} /> Volver</Link>
      <section className="moduleHero requestsHero">
        <span className="sectionKicker">Solicitudes reales</span>
        <h1>{user?.tipo_usuario === "prestador" ? "Gestiona clientes y trabajos entrantes." : "Da seguimiento a tus servicios solicitados."}</h1>
        <p>Esta pantalla consulta las solicitudes guardadas en SQL Server usando la sesión actual.</p>
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
          return (
            <article className="requestItem" key={request.id}>
              <div className="paymentIcon"><BriefcaseBusiness size={20} /></div>
              <div>
                <span className={`statusPill ${request.estado}`}>{statusLabels[request.estado] || request.estado}</span>
                <strong>{request.titulo_publicacion}</strong>
                <p>{otherName || "Usuario JobNest"} · {request.categoria} · {money(request.precio)}</p>
                <small><CalendarDays size={15} /> {request.fecha_servicio || "Fecha por definir"} {request.hora_servicio ? `· ${request.hora_servicio}` : ""}</small>
                {request.mensaje_cliente ? <blockquote>{request.mensaje_cliente}</blockquote> : null}
              </div>
              <div className="requestActions">
                <Link href="/mensajes"><MessageCircle size={17} /> Mensajes</Link>
                {user?.tipo_usuario === "prestador" && request.estado === "pendiente" ? <button onClick={() => void handleStatus(request.id, "aceptada")}><CheckCircle2 size={17} /> Aceptar</button> : null}
                {user?.tipo_usuario === "prestador" && request.estado === "pendiente" ? <button className="dangerAction" onClick={() => void handleStatus(request.id, "rechazada")}><XCircle size={17} /> Rechazar</button> : null}
                {user?.tipo_usuario === "prestador" && request.estado === "aceptada" ? <button onClick={() => void handleDone(request.id)}><CheckCircle2 size={17} /> Concluir</button> : null}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
