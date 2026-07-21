"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCheck, Clock3, Image, MessageCircle, Paperclip, Search, Send, ShieldCheck, Star } from "lucide-react";
import { fetchCurrentUser, listConversations, listMessages, sendMessage, type ChatMessage, type Conversation, type CurrentUser } from "../lib/api";

export default function MessagesPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;
  const filtered = useMemo(() => conversations.filter((conversation) => `${conversation.otro_nombre} ${conversation.titulo_publicacion}`.toLowerCase().includes(query.toLowerCase())), [conversations, query]);

  const loadConversations = async () => {
    setLoading(true);
    setMessage("");
    try {
      const current = await fetchCurrentUser();
      if (!current) throw new Error("Inicia sesión para ver tus mensajes.");
      setUser(current);
      const items = await listConversations();
      setConversations(items);
      setActiveId((currentActive) => currentActive ?? items[0]?.id ?? null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible cargar conversaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadConversations(); }, []);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let mounted = true;
    listMessages(activeId)
      .then((items) => { if (mounted) setMessages(items); })
      .catch((err) => { if (mounted) setMessage(err instanceof Error ? err.message : "No fue posible cargar mensajes."); });
    return () => { mounted = false; };
  }, [activeId]);

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim() || !active) return;
    setSending(true);
    setMessage("");
    try {
      await sendMessage({ hilo_id: active.id, mensaje: draft.trim() });
      setDraft("");
      setMessages(await listMessages(active.id));
      await loadConversations();
      setActiveId(active.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible enviar el mensaje.");
    } finally {
      setSending(false);
    }
  };

  const home = user?.tipo_usuario === "prestador" ? "/profesional" : "/cliente";

  return (
    <main className="messagesPage">
      <header className="moduleTopbar"><Link href={home} className="backLink"><ArrowLeft size={18} /> Volver</Link><strong>Mensajes</strong></header>
      <section className="messagesShell">
        <aside className="inboxPanel">
          <div className="inboxHeader"><span className="sectionKicker">Inbox real</span><h1>Conversaciones</h1></div>
          <label className="inboxSearch"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por servicio o persona" /></label>
          <div className="conversationList">
            {loading ? <div className="portfolioEmpty"><MessageCircle size={28} /><h3>Cargando...</h3></div> : null}
            {!loading && !filtered.length ? <div className="portfolioEmpty"><MessageCircle size={28} /><h3>Sin conversaciones</h3><p>Los hilos aparecen cuando existe una solicitud con mensajes.</p></div> : null}
            {filtered.map((conversation) => (
              <article className={conversation.id === activeId ? "conversationItem active" : "conversationItem"} key={conversation.id} onClick={() => setActiveId(conversation.id)}>
                <span className="conversationAvatar">{conversation.otro_nombre.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
                <div><strong>{conversation.otro_nombre}</strong><p>{conversation.titulo_publicacion}</p><small>{conversation.ultimo_mensaje || "Sin mensajes recientes"}</small></div>
                <time>{conversation.ultimo_enviado || ""}</time>
              </article>
            ))}
          </div>
        </aside>

        <section className="chatPanel">
          <div className="chatHeader">
            <div><span className="sectionKicker">Hilo de solicitud</span><h2>{active ? active.titulo_publicacion : "Selecciona una conversación"}</h2><p><ShieldCheck size={16} /> Mensajes conectados al backend real</p></div>
            {active ? <Link href="/solicitudes">Ver solicitud</Link> : <button disabled>Ver solicitud</button>}
          </div>
          <div className="serviceContextBar">
            <span><CalendarDays size={17} /> Solicitud #{active?.solicitud_id ?? "-"}</span>
            <span><Clock3 size={17} /> Seguimiento</span>
            <span><Star size={17} /> Conversación privada</span>
            <span><Image size={17} /> Contexto del servicio</span>
          </div>
          {message ? <div className="formAlert moduleAlert">{message}</div> : null}
          <div className="messageStream">
            {!active ? <div className="portfolioEmpty"><MessageCircle size={30} /><h3>Elige una conversación</h3></div> : null}
            {active && !messages.length ? <div className="portfolioEmpty"><MessageCircle size={30} /><h3>Aún no hay mensajes en este hilo</h3></div> : null}
            {messages.map((item) => <div className={item.emisor_nombre.includes(user?.nombres ?? "___") ? "messageBubble mine" : "messageBubble"} key={item.id}><p>{item.cuerpo}</p><time>{item.enviado_en} · {item.emisor_nombre}</time></div>)}
          </div>
          <form className="composer" onSubmit={handleSend}>
            <button type="button" aria-label="Adjuntar"><Paperclip size={19} /></button>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escribe un mensaje claro sobre el servicio..." disabled={!active} />
            <button type="submit" disabled={!active || sending}><Send size={19} /> {sending ? "Enviando" : "Enviar"}</button>
          </form>
        </section>

        <aside className="chatInsightPanel">
          <article><span className="sectionKicker">Confianza</span><h3>Resumen del hilo</h3><p>{active ? `Conversación con ${active.otro_nombre} sobre ${active.titulo_publicacion}.` : "Selecciona un hilo para ver contexto."}</p><div><CheckCheck size={18} /> Datos reales de la solicitud</div></article>
          <article><span className="sectionKicker">Siguiente paso</span><h3>Coordinar servicio</h3><p>Usa mensajes para acordar detalles antes de aceptar, pagar o concluir.</p><Link href="/solicitudes">Ir a solicitudes</Link></article>
        </aside>
      </section>
    </main>
  );
}
