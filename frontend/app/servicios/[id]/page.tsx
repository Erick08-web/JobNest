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
import { fetchCurrentUser, getPublication, getPublicationPortfolio, sendServiceRequest, type CurrentUser, type PortfolioWork, type Publication } from "../../lib/api";

function splitTags(value?: string) {
  return (value || "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function assetUrl(value?: string | null) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith("/api/backend") ? value : `/api/backend${value.startsWith("/") ? value : `/${value}`}`;
}

export default function ServiceProfilePage() {
  const params = useParams<{ id: string }>();
  const [publication, setPublication] = useState<Publication | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [sending, setSending] = useState(false);

  const loadProfile = () => {
    let mounted = true;
    setLoading(true);
    setMessage("");
    Promise.all([getPublication(params.id), getPublicationPortfolio(params.id).catch(() => []), fetchCurrentUser()])
      .then(([publicationData, portfolioData, userData]) => {
        if (!mounted) return;
        setPublication(publicationData);
        setPortfolio(portfolioData);
        setCurrentUser(userData);
      })
      .catch((err) => {
        if (!mounted) return;
        setMessage(err?.status === 401 ? "Inicia sesión para ver este perfil profesional." : err.message || "No fue posible cargar el perfil.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  };

  useEffect(() => loadProfile(), [params.id]);

  const tags = useMemo(() => splitTags(publication?.habilidades), [publication?.habilidades]);
  const galleryImages = useMemo(() => {
    const values = publication?.imagenes?.length ? publication.imagenes : publication?.imagen_principal ? [publication.imagen_principal] : [];
    return values.map(assetUrl).filter(Boolean);
  }, [publication?.imagen_principal, publication?.imagenes]);
  const isOwnPublication = Boolean(
    publication?.prestador_email &&
    currentUser?.correo &&
    publication.prestador_email.toLowerCase() === currentUser.correo.toLowerCase()
  );

  const handleRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!publication) return;
    if (isOwnPublication) {
      setMessage("No puedes solicitar un servicio publicado por tu propia cuenta.");
      return;
    }
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
    return <main className="profilePage"><div className="emptyResults serviceLoading"><Sparkles size={34} /><h3>Cargando perfil...</h3><p>Estamos preparando la información del profesional.</p></div></main>;
  }

  if (!publication) {
    return <main className="profilePage"><div className="emptyResults serviceLoading"><ShieldCheck size={34} /><h3>{message || "No fue posible cargar el perfil."}</h3><p>Inicia sesión para consultar este perfil profesional.</p><button type="button" onClick={loadProfile}>Reintentar</button><Link href="/login">Iniciar sesión</Link></div></main>;
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
        <div className="serviceMediaColumn">
          <div className="profilePortrait realServicePortrait">
            {galleryImages[0] ? <img src={galleryImages[0]} alt={publication.titulo} /> : null}
            <span><ShieldCheck size={18} /> Perfil conectado a JobNest</span>
          </div>
          {galleryImages.length > 1 ? (
            <div className="serviceGalleryStrip" aria-label="Fotos del servicio">
              {galleryImages.map((image, index) => <img key={`${image}-${index}`} src={image} alt={`${publication.titulo} ${index + 1}`} />)}
            </div>
          ) : null}
        </div>
        <div className="profileIntro">
          <span className="eyebrow"><Sparkles size={16} /> Perfil profesional</span>
          <h1>{publication.prestador_nombre || "Profesional JobNest"}</h1>
          <p className="profileRole">{publication.titulo}</p>
          <p className="profileBio">{publication.descripcion}</p>
          <div className="profileSignals">
            <span><Star size={18} fill="currentColor" /> {publication.experiencia} años de experiencia</span>
            <span><MapPin size={18} /> {publication.ubicacion}</span>
            <span><ImageIcon size={18} /> {portfolio.length || "Sin"} trabajos en portafolio</span>
            <span><BriefcaseBusiness size={18} /> {publication.categoria}</span>
            <span><Star size={18} fill="currentColor" /> {publication.promedio_calificacion ? `${publication.promedio_calificacion} (${publication.total_resenas || 0} reseñas)` : "Sin reseñas todavía"}</span>
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
          {isOwnPublication ? <p className="requestNotice">No puedes solicitar un servicio publicado por tu propia cuenta.</p> : null}
          {message ? <p className="requestNotice">{message}</p> : null}
          <form className="requestForm" onSubmit={handleRequest}>
            <label><span>Fecha</span><input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} required /></label>
            <label><span>Hora</span><input type="time" value={hora} onChange={(event) => setHora(event.target.value)} /></label>
            <label><span>Mensaje</span><textarea value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} placeholder="Describe qué necesitas y cualquier detalle importante." /></label>
            <button className="darkButton" disabled={sending || isOwnPublication}>{sending ? "Enviando..." : "Enviar solicitud"} <ChevronRight size={18} /></button>
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
            <p><CheckCircle2 size={17} /> Publicación disponible</p>
            <p><CheckCircle2 size={17} /> Datos del prestador validados por sesión</p>
            <p><CheckCircle2 size={17} /> Solicitud lista para seguimiento</p>
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
