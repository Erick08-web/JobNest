"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, MessageSquareText, Search, ShieldCheck, Star } from "lucide-react";
import { fetchCurrentUser, listCompletedServices, rateService, type CompletedService, type CurrentUser } from "../lib/api";

const quickOptions = [
  "Excelente comunicación y puntualidad",
  "Trabajo realizado como se acordó",
  "Recomendaría este servicio",
  "Buena experiencia general"
];

function money(value: number | null) {
  return value ? `$${value.toLocaleString("es-MX")}` : "Cotizar";
}

export default function ReviewsPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [services, setServices] = useState<CompletedService[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rating, setRating] = useState(5);
  const [quick, setQuick] = useState(quickOptions[0]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const current = await fetchCurrentUser();
      if (!current) throw new Error("Inicia sesión para ver reseñas.");
      setUser(current);
      const items = await listCompletedServices();
      setServices(items);
      setSelectedId((currentSelected) => currentSelected ?? items.find((item) => !item.mi_calificacion)?.id ?? items[0]?.id ?? null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible cargar servicios concluidos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const selected = services.find((item) => item.id === selectedId) ?? null;
  const pending = services.filter((item) => !item.mi_calificacion);
  const home = user?.tipo_usuario === "prestador" ? "/profesional" : "/cliente";

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await rateService({ solicitud_id: selected.id, calificacion: rating, comentario: comment, opcion_predeterminada: quick });
      setMessage(result.message || "Calificación guardada.");
      setComment("");
      setQuick(quickOptions[0]);
      setRating(5);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible guardar la reseña.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="reviewsPage">
      <header className="moduleTopbar"><Link href={home} className="backLink"><ArrowLeft size={18} /> Volver</Link><strong>Reseñas</strong></header>
      <section className="reviewsHero">
        <div>
          <span className="sectionKicker"><Star size={16} /> Confianza visible</span>
          <h1>Califica servicios concluidos y fortalece la reputación.</h1>
          <p>Las reseñas convierten trabajos terminados en señales claras para futuras contrataciones.</p>
        </div>
        <aside><ShieldCheck /><strong>{pending.length}</strong><span>Pendientes por calificar</span></aside>
      </section>

      {message ? <div className="formAlert reviewsAlert">{message}</div> : null}
      {loading ? <div className="portfolioEmpty reviewsAlert"><Search size={30} /><h3>Cargando servicios...</h3></div> : null}

      <section className="reviewsWorkspace">
        <div className="reviewServiceList">
          <div className="sectionTitleRow"><div><span className="sectionKicker">Servicios</span><h2>Concluidos</h2></div></div>
          {!services.length && !loading ? <div className="portfolioEmpty"><CheckCircle2 size={30} /><h3>No hay servicios concluidos</h3><p>Cuando un trabajo se marque como concluido aparecerá aquí.</p></div> : null}
          {services.map((service) => (
            <article className={selectedId === service.id ? "reviewServiceItem selected" : "reviewServiceItem"} key={service.id} onClick={() => setSelectedId(service.id)}>
              <div><strong>{service.titulo}</strong><p>{service.nombre_contratante} · {service.fecha_servicio || "Sin fecha"}</p><span>{money(service.precio)}</span></div>
              {service.mi_calificacion ? <span className="statusPill aceptada">Ya calificado</span> : <span className="statusPill pendiente">Pendiente</span>}
            </article>
          ))}
        </div>

        <form className="reviewForm" onSubmit={submit}>
          <span className="sectionKicker"><MessageSquareText size={16} /> Nueva reseña</span>
          <h2>{selected ? selected.titulo : "Selecciona un servicio"}</h2>
          {selected?.mi_calificacion ? <p className="existingReview">Ya calificaste este servicio con {selected.mi_calificacion} estrellas.</p> : null}
          <div className="ratingPicker">
            {[1, 2, 3, 4, 5].map((value) => <button type="button" className={value <= rating ? "active" : ""} onClick={() => setRating(value)} key={value}><Star size={24} fill="currentColor" /></button>)}
          </div>
          <label><span>Comentario rápido</span><select value={quick} onChange={(event) => setQuick(event.target.value)}>{quickOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label><span>Comentario adicional</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Agrega detalles sobre tu experiencia." /></label>
          <button className="submitButton" disabled={!selected || !!selected.mi_calificacion || saving}>{saving ? "Guardando..." : "Guardar reseña"}</button>
        </form>
      </section>
    </main>
  );
}
