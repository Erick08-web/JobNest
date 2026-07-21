import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

const cards = [['Datos de cuenta', 'Podemos almacenar nombre, correo, teléfono, tipo de usuario, foto de perfil y datos necesarios para iniciar sesión y administrar tu cuenta.'], ['Datos de actividad', 'Guardamos publicaciones, solicitudes, mensajes, pagos, agenda, portafolio y reseñas para que la plataforma funcione correctamente.'], ['Uso de la información', 'La información se utiliza para mostrar perfiles, conectar usuarios, dar seguimiento a servicios y mejorar la confianza en cada contratación.'], ['Fotos y portafolio', 'Las imágenes subidas por prestadores se muestran como evidencia de trabajos relacionados al servicio publicado.'], ['Seguridad', 'Las contraseñas se gestionan de forma protegida desde el backend existente. Los datos sensibles no deben compartirse dentro de mensajes públicos.'], ['Control del usuario', 'Puedes actualizar tus datos desde la sección Cuenta y administrar tus publicaciones desde el panel profesional.']];

export default function InfoPage() {
  return (
    <main className="infoPage">
      <header className="moduleTopbar"><Link href="/" className="backLink"><ArrowLeft size={18} /> Volver al inicio</Link><strong>JobNest</strong></header>
      <section className="infoHero">
        <div>
          <span className="sectionKicker"><Sparkles size={16} /> Confianza y datos</span>
          <h1>Política de privacidad</h1>
          <p>JobNest usa datos personales para operar cuentas, publicaciones, solicitudes, mensajes, pagos y reputación dentro de la plataforma.</p>
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
