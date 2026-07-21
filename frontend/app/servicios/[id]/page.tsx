"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star
} from "lucide-react";
import { getPublication, getPublicationPortfolio, sendServiceRequest, type PortfolioWork, type Publication } from "../../lib/api";

function splitTags(value?: string) {
  return (value || "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

export default function ServiceProfilePage() {
  const params = useParams<{ id: string }>();
  const [publication, setPublication] = useState<Publication | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([getPublication(params.id), getPublicationPortfolio(params.id).catch(() => [])])
      .then(([publicationData, portfolioData]) => {
        if (!mounted) return;
        setPublication(publicationData);
        setPortfolio(portfolioData);
      })
      .catch((err) => {
        if (!mounted) return;
        setMessage(err?.status === 401 ? "Inicia sesión para ver este perfil profesional." : err.message || "No fue posible cargar el perfil.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [params.id]);

  const tags = useMemo(() => splitTags(publication?.habilidades), [publication?.habilidades]);

  const handleRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!publication) return;
    setSending(true);
    setRequestMessage("");
    try {
      const result = await sendServiceRequest({ publicacion_id: publication.id, fecha_servicio: fecha, hora_servicio: hora, mensaje: requestMessage });
      setMessage(result.message || "Solicitud enviada correctamente.");
      setFecha("");
      setHora("");
      setRequestMessage("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible enviar la solicitud.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <main className="profilePage"><div className="emptyResults serviceLoading"><Sparkles size={34} /><h3>Cargando perfil real...</h3><p>Consultando Flask y SQL Server.</p></div></main>;
  }

  if (!publication) {
    return <main className="profilePage"><div className="emptyResults serviceLoading"><ShieldCheck size={34} /><h3>{message}</h3><p>La vista de perfil usa rutas protegidas del proyecto original.</p><Link href="/login">Iniciar sesión</Link></div></main>;
  }

  return (
    <main className="profilePage">
      <header className="profileNav">
        <Link href="/buscar"><ArrowLeft size={18} /> Volver a búsqueda</Link>
        <nav>
          <a href="#portafolio">Portafolio</a>
          <a href="#experiencia">Experiencia</a>
          <a href="#contratar">Contratar</a>
        </nav>
      </header>

      <section className="profileHero">
        <div className="profilePortrait realServicePortrait">
          <span><ShieldCheck size={18} /> Perfil conectado a JobNest</span>
        </div>
        <div className="profileIntro">
          <span className="eyebrow"><Sparkles size={16} /> Perfil profesional real</span>
          <h1>{publication.prestador_nombre || "Profesional JobNest"}</h1>
          <p className="profileRole">{publication.titulo}</p>
          <p className="profileBio">{publication.descripcion}</p>
          <div className="profileSignals">
            <span><Star size={18} fill="currentColor" /> {publication.experiencia} años de experiencia</span>
            <span><MapPin size={18} /> {publication.ubicacion}</span>
            <span><ImageIcon size={18} /> {portfolio.length || "Sin"} trabajos en portafolio</span>
            <span><BriefcaseBusiness size={18} /> {publication.categoria}</span>
          </div>
          <div className="profileActions">
            <a href="#contratar" className="primaryButton">Solicitar servicio</a>
            <Link href="/mensajes" className="secondaryButton"><MessageCircle size={18} /> Mensajes</Link>
          </div>
        </div>
        <aside className="bookingSummary" id="contratar">
          <span className="sectionKicker">Solicitud</span>
          <h2>{publication.precio_texto || (publication.precio ? `$${publication.precio}` : "Cotizar")}</h2>
          <p>{publication.categoria}</p>
          <div><Clock3 size={18} /> {publication.disponibilidad || "A convenir"}</div>
          <div><CalendarDays size={18} /> Publicado el {publication.fecha_creacion}</div>
          <div><BadgeCheck size={18} /> {publication.incluye_materiales ? "Incluye materiales" : "Materiales a convenir"}</div>
          {message ? <p className="requestNotice">{message}</p> : null}
          <form className="requestForm" onSubmit={handleRequest}>
            <label><span>Fecha</span><input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} required /></label>
            <label><span>Hora</span><input type="time" value={hora} onChange={(event) => setHora(event.target.value)} /></label>
            <label><span>Mensaje</span><textarea value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} placeholder="Describe qué necesitas y cualquier detalle importante." /></label>
            <button className="darkButton" disabled={sending}>{sending ? "Enviando..." : "Enviar solicitud"} <ChevronRight size={18} /></button>
          </form>
        </aside>
      </section>

      <section className="profileContent">
        <div className="profileMain">
          <article className="profileSectionCard" id="experiencia">
            <span className="sectionKicker">Especialidades</span>
            <h2>Qué ofrece este profesional</h2>
            <div className="tagRow spacious">{tags.length ? tags.map((tag) => <span key={tag}>{tag}</span>) : <span>{publication.categoria}</span>}</div>
            <p>{publication.descripcion}</p>
          </article>

          <article className="profileSectionCard" id="portafolio">
            <div className="sectionTitleRow">
              <div><span className="sectionKicker">Portafolio relacionado</span><h2>Trabajos subidos por el prestador</h2></div>
              <span className="portfolioCount">{portfolio.length} fotos</span>
            </div>
            {portfolio.length ? (
              <div className="portfolioGrid">
                {portfolio.map((item) => (
                  <article className="portfolioTile" key={item.id}>
                    <div className="portfolioVisual uploadedPortfolio" style={{ backgroundImage: `linear-gradient(180deg, rgba(16,24,40,0), rgba(16,24,40,.35)), url(/api/backend${item.imagen_url})` }} />
                    <div><strong>{item.titulo}</strong><p>{item.descripcion || "Trabajo agregado al portafolio del profesional."}</p></div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="portfolioEmpty"><ImageIcon size={30} /><h3>Aún no hay fotos en este servicio</h3><p>Cuando el prestador suba trabajos relacionados a este oficio aparecerán aquí.</p></div>
            )}
          </article>
        </div>

        <aside className="profileAside">
          <article className="asideCard">
            <span className="sectionKicker">Confianza</span>
            <p><CheckCircle2 size={17} /> Publicación activa en la base de datos</p>
            <p><CheckCircle2 size={17} /> Datos del prestador validados por sesión</p>
            <p><CheckCircle2 size={17} /> Solicitud conectada al backend real</p>
          </article>
          <article className="asideCard">
            <span className="sectionKicker">Contacto</span>
            <p><MessageCircle size={17} /> Al enviar solicitud se habilita el seguimiento desde tu panel.</p>
          </article>
        </aside>
      </section>
    </main>
  );
}
