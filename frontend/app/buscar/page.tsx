"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  Grid2X2,
  Heart,
  Image as ImageIcon,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  X
} from "lucide-react";
import { listActivePublications, searchPublications, type Publication } from "../lib/api";

const categories = ["Todos", "Hogar", "Reparaciones", "Diseño", "Tecnología", "Fotografía", "Construcción", "Legal", "Educación", "Otro"];
const availabilityOptions = ["Cualquiera", "Hoy", "Esta semana", "Agenda abierta", "A convenir"];
type SortMode = "recommended" | "recent" | "price" | "experience";

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function priceLabel(publication: Publication) {
  if (publication.precio_texto) return publication.precio_texto;
  if (!publication.precio) return "Consultar precio";
  const suffix: Record<string, string> = { hora: "/hora", servicio: "/servicio", dia: "/día", proyecto: "/proyecto" };
  return `$${publication.precio.toLocaleString("es-MX")}${suffix[publication.tipo_precio] ?? ""}`;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [availability, setAvailability] = useState("Cualquiera");
  const [maxPrice, setMaxPrice] = useState(5000);
  const [minExperience, setMinExperience] = useState(0);
  const [materialsOnly, setMaterialsOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>("recommended");
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    listActivePublications()
      .then((items) => {
        if (mounted) setPublications(items);
      })
      .catch((err) => {
        if (mounted) setError(err?.status === 401 ? "Para buscar profesionales reales inicia sesión en JobNest V2." : err.message || "No fue posible consultar publicaciones.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const filteredPublications = useMemo(() => {
    const term = normalize(query.trim());
    const results = publications.filter((publication) => {
      const searchable = normalize(`${publication.titulo} ${publication.descripcion} ${publication.habilidades} ${publication.categoria} ${publication.prestador_nombre ?? ""}`);
      const matchesQuery = !term || searchable.includes(term);
      const matchesCategory = category === "Todos" || publication.categoria === category;
      const matchesAvailability = availability === "Cualquiera" || (publication.disponibilidad || "A convenir") === availability;
      const matchesPrice = !publication.precio || publication.precio <= maxPrice;
      const matchesExperience = Number(publication.experiencia || 0) >= minExperience;
      const matchesMaterials = !materialsOnly || publication.incluye_materiales;
      return matchesQuery && matchesCategory && matchesAvailability && matchesPrice && matchesExperience && matchesMaterials;
    });

    return [...results].sort((a, b) => {
      if (sort === "price") return (a.precio ?? 999999) - (b.precio ?? 999999);
      if (sort === "experience") return Number(b.experiencia || 0) - Number(a.experiencia || 0);
      if (sort === "recent") return Number(b.id) - Number(a.id);
      return Number(b.experiencia || 0) + (b.incluye_materiales ? 1 : 0) - (Number(a.experiencia || 0) + (a.incluye_materiales ? 1 : 0));
    });
  }, [publications, query, category, availability, maxPrice, minExperience, materialsOnly, sort]);

  const handleRemoteSearch = async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category !== "Todos") params.set("categoria", category);
    if (maxPrice < 5000) params.set("precio_max", String(maxPrice));
    if (minExperience > 0) params.set("experiencia_min", String(minExperience));
    try {
      setPublications(await searchPublications(params));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible buscar publicaciones.");
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setQuery("");
    setCategory("Todos");
    setAvailability("Cualquiera");
    setMaxPrice(5000);
    setMinExperience(0);
    setMaterialsOnly(false);
    setSort("recommended");
  };

  return (
    <main className="searchPage">
      <header className="searchNav">
        <Link href="/" className="brandText">JobNest</Link>
        <nav>
          <Link href="/">Inicio</Link>
          <Link href="/buscar" className="active">Buscar</Link>
          <Link href="/cliente">Dashboard</Link>
          <Link href="/login">Iniciar sesión</Link>
        </nav>
      </header>

      <section className="searchHero">
        <div>
          <span className="eyebrow"><Sparkles size={16} /> Búsqueda real V2</span>
          <h1>Encuentra publicaciones reales de profesionales en JobNest.</h1>
          <p>La vista ya consulta tu base de datos. Filtra por oficio, precio, experiencia, disponibilidad y materiales.</p>
        </div>
        <form className="searchHeroPanel" onSubmit={(event) => { event.preventDefault(); void handleRemoteSearch(); }}>
          <Search size={22} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca por servicio, oficio o profesional" />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda"><X size={18} /></button> : null}
          <button type="submit" className="inlineSearchButton">Buscar</button>
        </form>
      </section>

      <section className="searchWorkspace">
        <aside className="filtersPanel" aria-label="Filtros de búsqueda">
          <div className="filtersHeader"><Filter size={20} /><strong>Filtros</strong><button onClick={resetFilters}>Limpiar</button></div>

          <div className="filterGroup">
            <span>Categoría</span>
            <div className="chipGrid">
              {categories.map((item) => <button className={category === item ? "selected" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}
            </div>
          </div>

          <div className="filterGroup">
            <span>Disponibilidad</span>
            <div className="stackedOptions">
              {availabilityOptions.map((item) => <button className={availability === item ? "selected" : ""} onClick={() => setAvailability(item)} key={item}><CalendarDays size={17} />{item}</button>)}
            </div>
          </div>

          <div className="filterGroup">
            <label htmlFor="priceRange">Precio máximo <strong>${maxPrice.toLocaleString("es-MX")}</strong></label>
            <input id="priceRange" type="range" min="250" max="5000" step="50" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} />
          </div>

          <div className="filterGroup">
            <label htmlFor="experienceRange">Experiencia mínima <strong>{minExperience} años</strong></label>
            <input id="experienceRange" type="range" min="0" max="20" step="1" value={minExperience} onChange={(event) => setMinExperience(Number(event.target.value))} />
          </div>

          <label className="toggleFilter">
            <input type="checkbox" checked={materialsOnly} onChange={(event) => setMaterialsOnly(event.target.checked)} />
            <span><ShieldCheck size={18} /> Incluye materiales</span>
          </label>
        </aside>

        <section className="resultsColumn">
          <div className="resultsToolbar">
            <div>
              <span>{loading ? "Consultando" : `${filteredPublications.length} resultados`}</span>
              <h2>{category === "Todos" ? "Publicaciones disponibles" : `Servicios en ${category}`}</h2>
            </div>
            <label>
              <ArrowUpDown size={18} />
              <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
                <option value="recommended">Recomendados</option>
                <option value="recent">Más recientes</option>
                <option value="price">Precio menor</option>
                <option value="experience">Más experiencia</option>
              </select>
            </label>
          </div>

          <div className="activeFilters">
            <span><Grid2X2 size={16} /> {category}</span>
            <span><Clock3 size={16} /> {availability}</span>
            <span><Star size={16} /> {minExperience}+ años</span>
            <span>${maxPrice.toLocaleString("es-MX")} máx.</span>
          </div>

          {error ? (
            <div className="emptyResults authRequiredBox">
              <ShieldCheck size={34} />
              <h3>{error}</h3>
              <p>El proyecto original protege las publicaciones detrás de sesión. Entra con tu cuenta para ver datos reales.</p>
              <Link href="/login">Iniciar sesión</Link>
            </div>
          ) : null}

          {loading ? <div className="emptyResults"><Search size={34} /><h3>Cargando publicaciones reales...</h3><p>Estamos consultando Flask y SQL Server.</p></div> : null}

          {!loading && !error ? (
            <div className="resultsGrid">
              {filteredPublications.map((publication, index) => (
                <article className="resultCard" key={publication.id}>
                  <div className={`resultVisual portrait${(index % 6) + 1}`}>
                    <button aria-label="Guardar publicación"><Heart size={19} /></button>
                    <span>{publication.disponibilidad || "A convenir"}</span>
                  </div>
                  <div className="resultContent">
                    <div className="resultTopline">
                      <span className="ratingPill"><Star size={16} fill="currentColor" /> {Number(publication.experiencia || 0)} años exp.</span>
                      {publication.incluye_materiales ? <span className="verifiedPill"><BadgeCheck size={16} /> Materiales incluidos</span> : null}
                    </div>
                    <h3>{publication.prestador_nombre || "Profesional JobNest"}</h3>
                    <p>{publication.categoria}</p>
                    <strong className="serviceName">{publication.titulo}</strong>
                    <div className="trustReason"><CheckCircle2 size={17} /> {publication.descripcion}</div>
                    <div className="resultMeta">
                      <span><MapPin size={16} /> {publication.ubicacion}</span>
                      <span><ImageIcon size={16} /> Portafolio disponible</span>
                      <span><BriefcaseBusiness size={16} /> {publication.fecha_creacion}</span>
                      <span><Clock3 size={16} /> {publication.disponibilidad || "A convenir"}</span>
                    </div>
                    <div className="tagRow">{(publication.habilidades || publication.categoria).split(",").slice(0, 4).map((tag) => <span key={tag}>{tag.trim()}</span>)}</div>
                    <div className="resultFooter">
                      <div><small>Desde</small><strong>{priceLabel(publication)}</strong></div>
                      <Link href={`/servicios/${publication.id}`}>Ver perfil <ChevronRight size={18} /></Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {!loading && !error && !filteredPublications.length ? (
            <div className="emptyResults">
              <Search size={34} />
              <h3>No encontramos publicaciones con esos filtros</h3>
              <p>Prueba ampliar precio, disponibilidad o categoría para ver más opciones.</p>
              <button onClick={resetFilters}>Restablecer filtros</button>
            </div>
          ) : null}
        </section>

        <aside className="contextPanel">
          <div className="contextCard">
            <span className="sectionKicker">Base real</span>
            <h3>Esta pantalla ya no usa datos demo.</h3>
            <p>Los resultados vienen de las publicaciones activas que existen en SQL Server mediante Flask.</p>
            <div className="contextMetric"><strong>{publications.length}</strong><span>publicaciones consultadas</span></div>
            <div className="contextMetric"><strong>{filteredPublications.filter((item) => item.incluye_materiales).length}</strong><span>incluyen materiales</span></div>
          </div>
        </aside>
      </section>
    </main>
  );
}
