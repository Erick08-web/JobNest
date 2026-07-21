export type Professional = {
  slug: string;
  name: string;
  role: string;
  category: string;
  service: string;
  location: string;
  rating: number;
  reviews: number;
  price: number;
  priceLabel: string;
  response: string;
  availability: string;
  verified: boolean;
  portfolio: number;
  completed: number;
  imageClass: string;
  tags: string[];
  trust: string;
  bio: string;
  experience: string;
  certifications: string[];
  schedule: string[];
};

export const professionals: Professional[] = [
  {
    slug: "mariana-torres",
    name: "Mariana Torres",
    role: "Interiorista residencial",
    category: "Diseño",
    service: "Remodelación e interiorismo",
    location: "Querétaro, Qro.",
    rating: 4.9,
    reviews: 38,
    price: 420,
    priceLabel: "$420/hora",
    response: "Responde en 2h",
    availability: "Esta semana",
    verified: true,
    portfolio: 14,
    completed: 62,
    imageClass: "portraitOne",
    tags: ["Remodelación", "Decoración", "Planos"],
    trust: "Portafolio con trabajos residenciales recientes",
    bio: "Diseño espacios residenciales cálidos, funcionales y fáciles de habitar. Trabajo con moodboards, distribución, mobiliario y seguimiento de obra ligera.",
    experience: "7 años diseñando interiores para departamentos, casas y estudios creativos.",
    certifications: ["Diplomado en interiorismo", "Gestión de obra residencial", "Visual merchandising"],
    schedule: ["Lunes a viernes · 9:00 a 18:00", "Sábados · asesorías programadas"]
  },
  {
    slug: "carlos-mendez",
    name: "Carlos Méndez",
    role: "Electricista certificado",
    category: "Reparaciones",
    service: "Instalación eléctrica residencial",
    location: "El Marqués, Qro.",
    rating: 4.8,
    reviews: 52,
    price: 300,
    priceLabel: "$300/hora",
    response: "Responde en 30min",
    availability: "Hoy",
    verified: true,
    portfolio: 21,
    completed: 88,
    imageClass: "portraitTwo",
    tags: ["Instalación", "Mantenimiento", "Urgencias"],
    trust: "Certificado y con disponibilidad para urgencias",
    bio: "Atiendo instalaciones, diagnósticos, centros de carga, mantenimiento y correcciones de seguridad eléctrica para casa o negocio.",
    experience: "10 años en instalación residencial y comercial ligera.",
    certifications: ["Técnico electricista", "Normativa de seguridad", "Diagnóstico preventivo"],
    schedule: ["Lunes a sábado · 8:00 a 20:00", "Urgencias con disponibilidad el mismo día"]
  },
  {
    slug: "andrea-ruiz",
    name: "Andrea Ruiz",
    role: "Fotógrafa comercial",
    category: "Fotografía",
    service: "Fotografía de producto y eventos",
    location: "Centro, Qro.",
    rating: 5.0,
    reviews: 27,
    price: 1800,
    priceLabel: "$1,800/proyecto",
    response: "Responde hoy",
    availability: "Agenda abierta",
    verified: true,
    portfolio: 36,
    completed: 44,
    imageClass: "portraitThree",
    tags: ["Producto", "Eventos", "Retrato"],
    trust: "Galería amplia con casos de producto y marca",
    bio: "Creo fotografía comercial limpia y expresiva para marcas locales, restaurantes, productos y eventos pequeños.",
    experience: "6 años creando contenido visual para negocios y emprendedores.",
    certifications: ["Fotografía comercial", "Dirección de arte", "Retoque digital"],
    schedule: ["Martes a sábado · 10:00 a 19:00", "Domingos para eventos bajo reserva"]
  },
  {
    slug: "daniel-ortiz",
    name: "Daniel Ortiz",
    role: "Desarrollador web",
    category: "Tecnología",
    service: "Sitios web para negocios",
    location: "Remoto / Querétaro",
    rating: 4.7,
    reviews: 31,
    price: 2400,
    priceLabel: "$2,400/proyecto",
    response: "Responde en 1h",
    availability: "Esta semana",
    verified: true,
    portfolio: 9,
    completed: 29,
    imageClass: "portraitFour",
    tags: ["Landing", "Ecommerce", "Automatización"],
    trust: "Casos publicados con métricas de negocio",
    bio: "Desarrollo sitios rápidos y claros para negocios que necesitan vender, captar clientes o automatizar procesos simples.",
    experience: "5 años trabajando con negocios locales y proyectos web a medida.",
    certifications: ["Frontend avanzado", "UX para conversión", "Automatización no-code"],
    schedule: ["Lunes a viernes · remoto", "Reuniones presenciales bajo agenda"]
  },
  {
    slug: "sofia-luna",
    name: "Sofía Luna",
    role: "Organización y limpieza premium",
    category: "Hogar",
    service: "Limpieza profunda y organización",
    location: "Juriquilla, Qro.",
    rating: 4.9,
    reviews: 46,
    price: 650,
    priceLabel: "$650/servicio",
    response: "Responde en 3h",
    availability: "Esta semana",
    verified: false,
    portfolio: 11,
    completed: 74,
    imageClass: "portraitFive",
    tags: ["Limpieza", "Organización", "Hogar"],
    trust: "Fotos de antes/después en servicios similares",
    bio: "Limpieza profunda y organización para hogares que necesitan orden, detalle y mantenimiento confiable.",
    experience: "4 años en limpieza premium y organización doméstica.",
    certifications: ["Manejo seguro de productos", "Organización por espacios"],
    schedule: ["Lunes a sábado · 8:00 a 17:00"]
  },
  {
    slug: "miguel-santos",
    name: "Miguel Santos",
    role: "Maestro de obra",
    category: "Construcción",
    service: "Remodelación y acabados",
    location: "Corregidora, Qro.",
    rating: 4.6,
    reviews: 24,
    price: 950,
    priceLabel: "$950/día",
    response: "Responde hoy",
    availability: "Agenda abierta",
    verified: true,
    portfolio: 18,
    completed: 37,
    imageClass: "portraitSix",
    tags: ["Acabados", "Pintura", "Remodelación"],
    trust: "Portafolio ligado a remodelaciones terminadas",
    bio: "Realizo remodelaciones, pintura, acabados y mantenimiento general con enfoque en limpieza y cumplimiento de tiempos.",
    experience: "12 años en remodelaciones residenciales.",
    certifications: ["Acabados residenciales", "Gestión de cuadrilla", "Seguridad en obra"],
    schedule: ["Lunes a sábado · 7:00 a 18:00"]
  }
];

export const portfolioItems = [
  { title: "Remodelación sala comedor", category: "Diseño", imageClass: "portfolioA", description: "Redistribución, paleta, iluminación cálida y selección de mobiliario." },
  { title: "Instalación segura", category: "Reparaciones", imageClass: "portfolioB", description: "Centro de carga renovado y cableado ordenado con revisión preventiva." },
  { title: "Sesión producto café", category: "Fotografía", imageClass: "portfolioC", description: "Fotografía para catálogo digital con dirección de luz y edición." },
  { title: "Landing para estudio", category: "Tecnología", imageClass: "portfolioD", description: "Página de conversión para captar solicitudes y mostrar portafolio." },
  { title: "Limpieza profunda", category: "Hogar", imageClass: "portfolioE", description: "Antes/después de cocina con organización por zonas." },
  { title: "Acabado interior", category: "Construcción", imageClass: "portfolioF", description: "Pintura, resane y acabado fino en habitación residencial." }
];

export const reviews = [
  { name: "Laura García", rating: 5, text: "Me dio confianza ver trabajos parecidos antes de contratar. Todo fue claro desde el inicio." },
  { name: "Fernando Ruiz", rating: 5, text: "Respondió rápido, explicó el proceso y cumplió el horario acordado." },
  { name: "Camila Pérez", rating: 4.8, text: "La comunicación fue ordenada y el resultado quedó como se prometió." }
];

export function getProfessional(slug: string) {
  return professionals.find((professional) => professional.slug === slug) ?? professionals[0];
}
