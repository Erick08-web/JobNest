import Link from "next/link";
import { notFound } from "next/navigation";
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
import { getProfessional, portfolioItems, professionals, reviews } from "../../lib/data";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return professionals.map((professional) => ({ slug: professional.slug }));
}

export default async function ProfessionalProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const professional = getProfessional(slug);
  if (!professional) notFound();

  const relatedPortfolio = portfolioItems.filter((item) => item.category === professional.category).slice(0, 3);
  const portfolio = relatedPortfolio.length ? relatedPortfolio : portfolioItems.slice(0, 3);

  return (
    <main className="profilePage">
      <header className="profileNav">
        <Link href="/buscar"><ArrowLeft size={18} /> Volver a búsqueda</Link>
        <nav>
          <a href="#portafolio">Portafolio</a>
          <a href="#resenas">Reseñas</a>
          <a href="#contratar">Contratar</a>
        </nav>
      </header>

      <section className="profileHero">
        <div className={`profilePortrait ${professional.imageClass}`}>
          <span><ShieldCheck size={18} /> {professional.verified ? "Profesional verificado" : "Perfil en revisión"}</span>
        </div>
        <div className="profileIntro">
          <span className="eyebrow"><Sparkles size={16} /> Perfil profesional V2</span>
          <h1>{professional.name}</h1>
          <p className="profileRole">{professional.role}</p>
          <p className="profileBio">{professional.bio}</p>
          <div className="profileSignals">
            <span><Star size={18} fill="currentColor" /> {professional.rating} · {professional.reviews} reseñas</span>
            <span><MapPin size={18} /> {professional.location}</span>
            <span><ImageIcon size={18} /> {professional.portfolio} fotos de portafolio</span>
            <span><BriefcaseBusiness size={18} /> {professional.completed} trabajos</span>
          </div>
          <div className="profileActions">
            <a href="#contratar" className="primaryButton">Solicitar servicio</a>
            <Link href="/mensajes" className="secondaryButton"><MessageCircle size={18} /> Contactar</Link>
          </div>
        </div>
        <aside className="bookingSummary" id="contratar">
          <span className="sectionKicker">Resumen</span>
          <h2>{professional.priceLabel}</h2>
          <p>{professional.service}</p>
          <div><Clock3 size={18} /> {professional.response}</div>
          <div><CalendarDays size={18} /> {professional.availability}</div>
          <div><BadgeCheck size={18} /> {professional.trust}</div>
          <Link href="/solicitudes" className="darkButton">Iniciar solicitud <ChevronRight size={18} /></Link>
        </aside>
      </section>

      <section className="profileContent">
        <div className="profileMain">
          <article className="profileSectionCard">
            <span className="sectionKicker">Especialidades</span>
            <h2>Qué puede resolver</h2>
            <div className="tagRow spacious">{professional.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            <p>{professional.experience}</p>
          </article>

          <article className="profileSectionCard" id="portafolio">
            <div className="sectionTitleRow">
              <div><span className="sectionKicker">Portafolio relacionado</span><h2>Trabajos que prueban experiencia</h2></div>
              <span className="portfolioCount">{professional.portfolio} fotos</span>
            </div>
            <div className="portfolioGrid">
              {portfolio.map((item) => (
                <article className="portfolioTile" key={item.title}>
                  <div className={`portfolioVisual ${item.imageClass}`} />
                  <div><strong>{item.title}</strong><p>{item.description}</p></div>
                </article>
              ))}
            </div>
          </article>

          <article className="profileSectionCard" id="resenas">
            <span className="sectionKicker">Reseñas</span>
            <h2>Lo que dicen los clientes</h2>
            <div className="reviewList">
              {reviews.map((review) => (
                <blockquote className="reviewCard" key={review.name}>
                  <div><Star size={16} fill="currentColor" /> {review.rating}</div>
                  <p>“{review.text}”</p>
                  <cite>{review.name}</cite>
                </blockquote>
              ))}
            </div>
          </article>
        </div>

        <aside className="profileAside">
          <article className="asideCard">
            <span className="sectionKicker">Certificaciones</span>
            {professional.certifications.map((certification) => <p key={certification}><CheckCircle2 size={17} /> {certification}</p>)}
          </article>
          <article className="asideCard">
            <span className="sectionKicker">Horarios</span>
            {professional.schedule.map((item) => <p key={item}><CalendarDays size={17} /> {item}</p>)}
          </article>
        </aside>
      </section>
    </main>
  );
}
