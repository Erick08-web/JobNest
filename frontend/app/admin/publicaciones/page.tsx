"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, Search, XCircle } from "lucide-react";
import { CompactDashboardRail } from "../../components/SessionNav";
import { fetchCurrentUser, listAdminPublications, reviewAdminPublication, toggleAdminPublication, type AdminPublication } from "../../lib/api";

function money(value: number) {
  return `$${value.toLocaleString("es-MX")}`;
}

function statusClass(value: boolean | string) {
  if (typeof value === "boolean") return value ? "aceptada" : "rechazada";
  return value.toLowerCase().replace(/\s+/g, "-");
}

export default function AdminPublicationsPage() {
  const [publications, setPublications] = useState<AdminPublication[]>([]);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("todas");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const current = await fetchCurrentUser();
      if (!current || current.tipo_usuario !== "administrador") throw new Error("Acceso reservado para administradores.");
      setPublications(await listAdminPublications());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible cargar publicaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = publications.filter((item) => filter === "todas" || item.estado_revision === filter);

  const review = async (id: number, estado: "aprobada" | "rechazada") => {
    setWorkingId(`review-${id}-${estado}`);
    setMessage("");
    try {
      const result = await reviewAdminPublication(id, { estado, comentario: note });
      setMessage(result.message || "Revisión guardada.");
      setNote("");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible guardar la revisión.");
    } finally {
      setWorkingId(null);
    }
  };

  const toggle = async (id: number) => {
    setWorkingId(`toggle-${id}`);
    setMessage("");
    try {
      const result = await toggleAdminPublication(id);
      setMessage(result.message || "Publicación actualizada.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible actualizar la publicación.");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <main className="dashboardV2 adminDashboard">
      <CompactDashboardRail role="administrador" />
      <section className="dashboardCanvas">
        <header className="adminSectionHeader">
          <div><span className="sectionKicker"><ClipboardList size={16} /> Moderación</span><h1>Publicaciones</h1><p>Valida oficio, descripción, precio y datos antes de que aparezcan al cliente.</p></div>
          <Link href="/admin">Resumen</Link>
        </header>

        {message ? <div className="formAlert moduleAlert">{message}</div> : null}
        {loading ? <div className="portfolioEmpty"><Search size={30} /><h3>Cargando publicaciones...</h3></div> : null}

        <section className="dashPanel adminTablePanel">
          <div className="sectionTitleRow">
            <div><span className="sectionKicker">Cola de revisión</span><h2>Validación administrativa</h2></div>
            <select className="adminFilter" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="todas">Todas</option>
              <option value="pendiente">Pendientes</option>
              <option value="aprobada">Aprobadas</option>
              <option value="rechazada">Rechazadas</option>
            </select>
          </div>
          <textarea className="adminReviewNote" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Observaciones o motivo de rechazo para el prestador" />
          <div className="adminPublicationGrid reviewGrid">
            {filtered.map((item) => (
              <article className="adminPublicationCard reviewCard" key={item.id}>
                <div><strong>{item.titulo}</strong><span>{item.categoria} · {item.prestador_nombre}</span></div>
                <p>{item.descripcion}</p>
                <small>{item.ubicacion} · {item.experiencia ?? 0} años · {item.habilidades || "Sin habilidades"} · {item.precio ? money(item.precio) : "Cotizar"}</small>
                <div>
                  <span className={`statusPill ${statusClass(item.estado_revision)}`}>{item.estado_revision}</span>
                  <span className={`statusPill ${statusClass(item.activa)}`}>{item.activa ? "Activa" : "Inactiva"}</span>
                </div>
                <div>
                  <button type="button" onClick={() => void review(item.id, "aprobada")} disabled={workingId === `review-${item.id}-aprobada`}><CheckCircle2 size={15} /> Aprobar</button>
                  <button type="button" className="dangerButton" onClick={() => void review(item.id, "rechazada")} disabled={workingId === `review-${item.id}-rechazada`}><XCircle size={15} /> Rechazar</button>
                  <button type="button" onClick={() => void toggle(item.id)} disabled={workingId === `toggle-${item.id}`}>{item.activa ? "Ocultar" : "Activar"}</button>
                </div>
              </article>
            ))}
            {!filtered.length ? <p className="mutedPanelText">No hay publicaciones para este filtro.</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
