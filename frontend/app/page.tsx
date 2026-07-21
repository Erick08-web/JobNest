import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  CreditCard,
  Hammer,
  Home,
  MapPin,
  MessageCircle,
  Paintbrush,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  UserRoundCheck,
  Wrench
} from "lucide-react";

const categories = [
  { name: "Hogar", icon: Home, count: "84 expertos", accent: "mint" },
  { name: "Reparaciones", icon: Wrench, count: "62 técnicos", accent: "blue" },
  { name: "Diseño", icon: Paintbrush, count: "39 creativos", accent: "violet" },
  { name: "Tecnología", icon: Code2, count: "47 devs", accent: "graphite" },
  { name: "Fotografía", icon: Camera, count: "31 perfiles", accent: "amber" },
  { name: "Construcción", icon: Hammer, count: "28 equipos", accent: "teal" }
];

const professionals = [
  {
    name: "Mariana Torres",
    role: "Interiorista residencial",
    location: "Querétaro, Qro.",
    rating: "4.9",
    reviews: "38 reseñas",
    price: "$420/hora",
    availability: "Disponible esta semana",
    imageClass: "portraitOne",
    tags: ["Remodelación", "Decoración", "Planos"]
  },
  {
    name: "Carlos Méndez",
    role: "Electricista certificado",
    location: "El Marqués, Qro.",
    rating: "4.8",
    reviews: "52 reseñas",
    price: "$300/hora",
    availability: "Respuesta rápida",
    imageClass: "portraitTwo",
    tags: ["Instalación", "Mantenimiento", "Urgencias"]
  },
  {
    name: "Andrea Ruiz",
    role: "Fotógrafa comercial",
    location: "Centro, Qro.",
    rating: "5.0",
    reviews: "27 reseñas",
    price: "$1,800/proyecto",
    availability: "Agenda abierta",
    imageClass: "portraitThree",
    tags: ["Producto", "Eventos", "Retrato"]
  }
];

const services = [
  "Instalación eléctrica residencial",
  "Diseño de identidad visual",
  "Fotografía de producto",
  "Mantenimiento preventivo",
  "Desarrollo web para negocios",
  "Remodelación de espacios"
];

const benefits = [
  { icon: ShieldCheck, title: "Confianza visible", text: "Perfiles con reseñas, portafolio, disponibilidad y señales claras antes de contactar." },
  { icon: SlidersHorizontal, title: "Comparación rápida", text: "Filtros y tarjetas diseñadas para decidir sin perder tiempo entre opciones confusas." },
  { icon: CalendarCheck, title: "Contratación guiada", text: "Solicitud, agenda, mensajes y pago en una experiencia ordenada de principio a fin." }
];

function NavBar() {
  return (
    <header className="siteNav">
      <Link href="/" className="brand" aria-label="JobNest inicio">
        <Image src="/images/logo.jpeg" alt="JobNest" width={38} height={38} />
        <span>JobNest</span>
      </Link>
      <nav className="navLinks" aria-label="Navegación principal">
        <a href="#categorias">Categorías</a>
        <a href="#como-funciona">Cómo funciona</a>
        <a href="#profesionales">Profesionales</a>
        <a href="#beneficios">Beneficios</a>
      </nav>
      <div className="navActions">
        <a href="/login" className="ghostButton">Iniciar sesión</a>
        <a href="/registro" className="primaryButton">Publicar servicio</a>
      </div>
    </header>
  );
}

function SearchPanel() {
  return (
    <form className="searchPanel" action="/buscar">
      <label>
        <span>¿Qué necesitas?</span>
        <div>
          <Search size={20} />
          <input name="q" placeholder="Electricista, diseñador, fotógrafo..." />
        </div>
      </label>
      <label>
        <span>Ubicación</span>
        <div>
          <MapPin size={20} />
          <input name="location" placeholder="Querétaro" />
        </div>
      </label>
      <label>
        <span>Fecha</span>
        <div>
          <Clock3 size={20} />
          <input name="date" placeholder="Esta semana" />
        </div>
      </label>
      <button type="submit" aria-label="Buscar profesionales">
        <Search size={20} />
        Buscar
      </button>
    </form>
  );
}

function Hero() {
  return (
    <section className="heroSection">
      <div className="heroContent">
        <div className="heroCopy">
          <span className="eyebrow"><Sparkles size={16} /> Plataforma de confianza profesional</span>
          <h1>Contrata profesionales con evidencia, no con suerte.</h1>
          <p>
            JobNest V2 convierte la búsqueda de servicios en una experiencia clara: compara perfiles,
            revisa portafolios reales y solicita ayuda con señales de confianza desde el primer vistazo.
          </p>
          <SearchPanel />
          <div className="trustStrip" aria-label="Indicadores de confianza">
            <span><BadgeCheck size={18} /> Profesionales verificados</span>
            <span><Star size={18} /> Reseñas visibles</span>
            <span><CreditCard size={18} /> Pagos organizados</span>
          </div>
        </div>
        <aside className="heroShowcase" aria-label="Vista previa de JobNest V2">
          <div className="showcasePhoto">
            <Image src="/images/hero.jpg" alt="Profesional trabajando" fill priority sizes="(max-width: 900px) 100vw, 44vw" />
            <div className="floatingBadge"><ShieldCheck size={18} /> Trabajo verificado</div>
          </div>
          <div className="previewCard elevated">
            <div className="previewHeader">
              <span className="avatarMark">MT</span>
              <div><strong>Mariana Torres</strong><small>Interiorista · 4.9</small></div>
            </div>
            <div className="miniGallery"><span /><span /><span /></div>
            <button>Ver portafolio relacionado</button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function Categories() {
  return (
    <section className="sectionShell" id="categorias">
      <div className="sectionHeader splitHeader">
        <div>
          <span className="sectionKicker">Categorías principales</span>
          <h2>Empieza por el tipo de confianza que necesitas.</h2>
        </div>
        <p>Las categorías no son solo etiquetas: ayudan a mostrar experiencia, trabajos y criterios de comparación distintos.</p>
      </div>
      <div className="categoryGrid">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <a href={`/buscar?categoria=${encodeURIComponent(category.name)}`} className={`categoryCard ${category.accent}`} key={category.name}>
              <span className="iconSurface"><Icon size={24} /></span>
              <strong>{category.name}</strong>
              <small>{category.count}</small>
              <ChevronRight size={20} />
            </a>
          );
        })}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { title: "Busca con contexto", text: "Describe el servicio, ubicación y fecha. JobNest prioriza resultados fáciles de comparar." },
    { title: "Evalúa confianza", text: "Revisa reseñas, disponibilidad, precio y portafolio asociado al oficio exacto." },
    { title: "Solicita y coordina", text: "Envía la solicitud, conversa con el profesional y da seguimiento desde tu panel." }
  ];
  return (
    <section className="processBand" id="como-funciona">
      <div className="sectionShell processLayout">
        <div className="sectionHeader darkHeader">
          <span className="sectionKicker">Cómo funciona</span>
          <h2>Un flujo pensado para reducir incertidumbre.</h2>
          <p>La experiencia guía al cliente desde la búsqueda hasta la contratación sin esconder la información importante.</p>
        </div>
        <div className="stepGrid">
          {steps.map((step, index) => (
            <article className="stepCard" key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Professionals() {
  return (
    <section className="sectionShell" id="profesionales">
      <div className="sectionHeader splitHeader">
        <div>
          <span className="sectionKicker">Profesionales destacados</span>
          <h2>Cards diseñadas para decidir, no solo para mirar.</h2>
        </div>
        <a className="secondaryButton" href="/buscar">Explorar todos</a>
      </div>
      <div className="professionalGrid">
        {professionals.map((pro) => (
          <article className="professionalCard" key={pro.name}>
            <div className={`professionalImage ${pro.imageClass}`}>
              <span>{pro.availability}</span>
            </div>
            <div className="professionalBody">
              <div className="ratingRow"><Star size={17} fill="currentColor" /> {pro.rating} <span>{pro.reviews}</span></div>
              <h3>{pro.name}</h3>
              <p>{pro.role}</p>
              <div className="locationRow"><MapPin size={16} /> {pro.location}</div>
              <div className="tagRow">{pro.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <div className="cardFooter"><strong>{pro.price}</strong><a href="/buscar">Ver perfil</a></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PopularServices() {
  return (
    <section className="sectionShell servicesSection">
      <div className="sectionHeader centerHeader">
        <span className="sectionKicker">Servicios populares</span>
        <h2>Servicios listos para comparar.</h2>
        <p>Cada servicio debe llevar al usuario a resultados con precio, reseñas, fotos y disponibilidad.</p>
      </div>
      <div className="serviceList">
        {services.map((service, index) => (
          <a href="/buscar" key={service}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{service}</strong>
            <ArrowRight size={20} />
          </a>
        ))}
      </div>
    </section>
  );
}

function Benefits() {
  return (
    <section className="benefitsBand" id="beneficios">
      <div className="sectionShell benefitsLayout">
        <div className="sectionHeader">
          <span className="sectionKicker">Beneficios</span>
          <h2>JobNest no muestra opciones: ayuda a elegir bien.</h2>
        </div>
        <div className="benefitGrid">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <article className="benefitCard" key={benefit.title}>
                <Icon size={26} />
                <h3>{benefit.title}</h3>
                <p>{benefit.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="sectionShell testimonialsSection">
      <div className="testimonialLead">
        <span className="sectionKicker">Testimonios</span>
        <h2>La confianza cambia la decisión.</h2>
      </div>
      <div className="testimonialGrid">
        <blockquote>
          <p>“No tuve que preguntar diez veces por WhatsApp. Vi trabajos, reseñas y disponibilidad antes de solicitar.”</p>
          <cite>Laura García · Cliente</cite>
        </blockquote>
        <blockquote>
          <p>“Mi portafolio por servicio hace que los clientes entiendan rápido qué hago y por qué contratarme.”</p>
          <cite>Roberto Medina · Profesional</cite>
        </blockquote>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="sectionShell ctaSection">
      <div className="ctaPanel">
        <div>
          <span className="sectionKicker">Empieza con claridad</span>
          <h2>Encuentra al profesional correcto con menos incertidumbre.</h2>
        </div>
        <div className="ctaActions">
          <a className="lightButton" href="/buscar">Buscar servicios</a>
          <a className="darkButton" href="/registro">Crear cuenta</a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footerGrid">
        <div>
          <Link href="/" className="footerBrand"><Image src="/images/logo.jpeg" alt="JobNest" width={34} height={34} />JobNest</Link>
          <p>Plataforma de confianza profesional para contratar servicios con evidencia, claridad y control.</p>
        </div>
        <div>
          <h4>Producto</h4>
          <a href="#categorias">Categorías</a>
          <a href="#profesionales">Profesionales</a>
          <a href="#beneficios">Beneficios</a>
        </div>
        <div>
          <h4>Cuenta</h4>
          <a href="/login">Iniciar sesión</a>
          <a href="/profesional">Publicar servicio</a>
          <a href="/buscar">Dashboard</a>
        </div>
        <div>
          <h4>Confianza</h4>
          <a href="/terminos">Términos</a>
          <a href="/privacidad">Privacidad</a>
          <a href="/ayuda">Ayuda</a>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <main>
      <NavBar />
      <Hero />
      <Categories />
      <HowItWorks />
      <Professionals />
      <PopularServices />
      <Benefits />
      <Testimonials />
      <Cta />
      <Footer />
    </main>
  );
}
