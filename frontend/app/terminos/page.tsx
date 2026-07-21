import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

const cards = [['Uso de la plataforma', 'JobNest conecta clientes con profesionales independientes. Cada usuario es responsable de la información que publica, solicita o comparte durante la contratación.'], ['Publicaciones y servicios', 'Los prestadores deben describir sus servicios con información real sobre precio, disponibilidad, experiencia, alcance y condiciones del trabajo.'], ['Solicitudes y acuerdos', 'Las solicitudes, mensajes y pagos registrados en la plataforma ayudan a documentar el acuerdo entre cliente y profesional.'], ['Conducta esperada', 'No se permite publicar información falsa, contenido ofensivo, servicios ilegales o cualquier acción que afecte la seguridad de otros usuarios.'], ['Pagos', 'Los pagos registrados en JobNest se asocian a solicitudes aceptadas. El usuario debe revisar monto, servicio y método antes de confirmar.'], ['Cambios', 'Estos términos pueden actualizarse para mejorar la operación y seguridad del producto. La versión vigente será la visible en esta página.']];

export default function InfoPage() {
  return (
    <main className="infoPage">
      <header className="moduleTopbar"><Link href="/" className="backLink"><ArrowLeft size={18} /> Volver al inicio</Link><strong>JobNest</strong></header>
      <section className="infoHero">
        <div>
          <span className="sectionKicker"><Sparkles size={16} /> Marco de uso</span>
          <h1>Términos y condiciones de JobNest</h1>
          <p>Reglas claras para que clientes y profesionales usen la plataforma con responsabilidad, respeto y confianza.</p>
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
