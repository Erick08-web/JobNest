import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

const cards = [['¿Cómo busco un servicio?', 'Inicia sesión, entra a Buscar, filtra por categoría, precio, experiencia o disponibilidad y abre el perfil del servicio que te interese.'], ['¿Cómo envío una solicitud?', 'Desde el perfil de un servicio elige fecha, hora y escribe un mensaje. La solicitud aparecerá en tu dashboard y en la pantalla Solicitudes.'], ['¿Cómo publico un servicio?', 'Con una cuenta de prestador entra a Publicar, completa título, descripción, precio, experiencia, habilidades y disponibilidad.'], ['¿Cómo agrego portafolio?', 'En Publicar selecciona una publicación existente y sube fotos relacionadas al oficio para generar más confianza.'], ['¿Dónde veo mensajes?', 'La pantalla Mensajes muestra conversaciones ligadas a solicitudes reales para coordinar detalles del servicio.'], ['¿Cómo califico un servicio?', 'Cuando un trabajo esté concluido entra a Reseñas y califica la experiencia con estrellas y comentario.']];

export default function InfoPage() {
  return (
    <main className="infoPage">
      <header className="moduleTopbar"><Link href="/" className="backLink"><ArrowLeft size={18} /> Volver al inicio</Link><strong>JobNest</strong></header>
      <section className="infoHero">
        <div>
          <span className="sectionKicker"><Sparkles size={16} /> Centro de ayuda</span>
          <h1>Ayuda y preguntas frecuentes</h1>
          <p>Respuestas rápidas para usar JobNest V2 como cliente o prestador sin volver al diseño anterior.</p>
        </div>
        <aside><ShieldCheck /><strong>V2</strong><span>Experiencia clara y segura</span></aside>
      </section>
      <section className="infoGrid">
        {cards.map(([title, text]) => (
          <article className="infoCard" key={title}>
            <CheckCircle2 />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
