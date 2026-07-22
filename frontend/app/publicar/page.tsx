"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, Camera, CheckCircle2, ImagePlus, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { createPublication, editPublication, fetchCurrentUser, listMyPublications, togglePublication, uploadPortfolioWork, type CurrentUser, type Publication } from "../lib/api";

const categories = ["Hogar", "Reparaciones", "Diseño", "Tecnología", "Fotografía", "Construcción", "Legal", "Educación", "Otro"];
const priceTypes = [
  { value: "hora", label: "Por hora" },
  { value: "servicio", label: "Por servicio" },
  { value: "dia", label: "Por día" },
  { value: "proyecto", label: "Por proyecto" }
];

export default function PublishPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ titulo: "", descripcion: "", categoria: "Reparaciones", salario: "", ubicacion: "Querétaro", experiencia: "1", habilidades: "", disponibilidad: "A convenir", tipo_precio: "servicio", incluye_materiales: false });
  const [portfolio, setPortfolio] = useState<{ publicacion_id: string; titulo: string; descripcion: string; imagen: File | null }>({ publicacion_id: "", titulo: "", descripcion: "", imagen: null });

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const current = await fetchCurrentUser();
      if (!current) throw new Error("Inicia sesión como prestador para publicar servicios.");
      setUser(current);
      if (current.tipo_usuario !== "prestador") throw new Error("Solo las cuentas de prestador pueden publicar servicios.");
      const items = await listMyPublications();
      setPublications(items);
      setPortfolio((currentPortfolio) => ({ ...currentPortfolio, publicacion_id: currentPortfolio.publicacion_id || String(items[0]?.id ?? "") }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible cargar tus publicaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const update = (name: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [name]: value }));

  const resetPublicationForm = () => {
    setEditingId(null);
    setForm({ titulo: "", descripcion: "", categoria: "Reparaciones", salario: "", ubicacion: "Querétaro", experiencia: "1", habilidades: "", disponibilidad: "A convenir", tipo_precio: "servicio", incluye_materiales: false });
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const result = editingId ? await editPublication(editingId, form) : await createPublication(form);
      setMessage(result.message || (editingId ? "Publicación actualizada correctamente." : "Publicación creada correctamente."));
      resetPublicationForm();
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : (editingId ? "No fue posible editar la publicación." : "No fue posible crear la publicación."));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (publication: Publication) => {
    setEditingId(publication.id);
    setForm({
      titulo: publication.titulo || "",
      descripcion: publication.descripcion || "",
      categoria: publication.categoria || "Reparaciones",
      salario: publication.precio ? String(publication.precio) : "",
      ubicacion: publication.ubicacion || "Querétaro",
      experiencia: publication.experiencia ? String(publication.experiencia) : "1",
      habilidades: publication.habilidades || "",
      disponibilidad: publication.disponibilidad || "A convenir",
      tipo_precio: publication.tipo_precio || "servicio",
      incluye_materiales: Boolean(publication.incluye_materiales)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggle = async (id: number) => {
    setMessage("");
    try {
      const result = await togglePublication(id);
      setMessage(result.message || "Estado de publicación actualizado.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible cambiar el estado.");
    }
  };

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!portfolio.imagen) {
      setMessage("Selecciona una foto para subir al portafolio.");
      return;
    }
    setUploading(true);
    setMessage("");
    try {
      const result = await uploadPortfolioWork({ publicacion_id: portfolio.publicacion_id, titulo: portfolio.titulo, descripcion: portfolio.descripcion, imagen: portfolio.imagen });
      setMessage(result.message || "Trabajo agregado al portafolio.");
      setPortfolio({ publicacion_id: portfolio.publicacion_id, titulo: "", descripcion: "", imagen: null });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible subir el trabajo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="publishPage">
      <header className="moduleTopbar"><Link href="/profesional" className="backLink"><ArrowLeft size={18} /> Volver</Link><strong>Publicar servicio</strong></header>
      <section className="publishHero">
        <div>
          <span className="sectionKicker"><Sparkles size={16} /> JobNest Pro</span>
          <h1>{user ? `${user.nombres}, convierte tu oficio en una publicación confiable.` : "Publica un servicio profesional."}</h1>
          <p>Crea servicios claros con precio, experiencia, habilidades y portafolio relacionado para que el cliente pueda confiar antes de contratar.</p>
        </div>
        <aside><ShieldCheck /><strong>{publications.length}</strong><span>Publicaciones en tu cuenta</span></aside>
      </section>

      {message ? <div className="formAlert moduleAlert publishAlert">{message}</div> : null}
      {loading ? <div className="portfolioEmpty publishLoading"><BriefcaseBusiness size={30} /><h3>Cargando tu cuenta...</h3></div> : null}

      <section className="publishWorkspace">
        <form className="publishForm" onSubmit={handleCreate}>
          <div className="sectionTitleRow"><div><span className="sectionKicker">{editingId ? "Editando servicio" : "Nuevo servicio"}</span><h2>{editingId ? "Editar publicación" : "Información principal"}</h2></div>{editingId ? <button type="button" className="smallGhostButton" onClick={resetPublicationForm}>Cancelar edición</button> : <Plus />}</div>
          <label className="fullField"><span>Título del servicio</span><input value={form.titulo} onChange={(event) => update("titulo", event.target.value)} placeholder="Ej. Instalación eléctrica residencial" required /></label>
          <label className="fullField"><span>Descripción</span><textarea value={form.descripcion} onChange={(event) => update("descripcion", event.target.value)} placeholder="Explica qué haces, qué incluye y cómo trabajas." required /></label>
          <div className="formGrid">
            <label><span>Categoría</span><select value={form.categoria} onChange={(event) => update("categoria", event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Precio</span><input value={form.salario} onChange={(event) => update("salario", event.target.value)} placeholder="650" inputMode="decimal" /></label>
            <label><span>Tipo de precio</span><select value={form.tipo_precio} onChange={(event) => update("tipo_precio", event.target.value)}>{priceTypes.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            <label><span>Ubicación</span><input value={form.ubicacion} onChange={(event) => update("ubicacion", event.target.value)} required /></label>
            <label><span>Años de experiencia</span><input value={form.experiencia} onChange={(event) => update("experiencia", event.target.value)} inputMode="numeric" required /></label>
            <label><span>Disponibilidad</span><input value={form.disponibilidad} onChange={(event) => update("disponibilidad", event.target.value)} placeholder="Hoy, esta semana, agenda abierta" /></label>
          </div>
          <label className="fullField"><span>Habilidades</span><input value={form.habilidades} onChange={(event) => update("habilidades", event.target.value)} placeholder="Instalación, mantenimiento, urgencias" /></label>
          <label className="publishCheck"><input type="checkbox" checked={form.incluye_materiales} onChange={(event) => update("incluye_materiales", event.target.checked)} /><span>Incluye materiales</span></label>
          <button className="submitButton" disabled={saving}>{saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear publicación"}</button>
        </form>

        <aside className="publishSide">
          <form className="portfolioUploadCard" onSubmit={handleUpload}>
            <span className="sectionKicker"><Camera size={16} /> Portafolio</span>
            <h2>Sube evidencia visual</h2>
            <p>Relaciona fotos con un servicio específico para que el cliente vea trabajos parecidos al que necesita.</p>
            <label><span>Servicio relacionado</span><select value={portfolio.publicacion_id} onChange={(event) => setPortfolio({ ...portfolio, publicacion_id: event.target.value })}>{publications.map((item) => <option value={item.id} key={item.id}>{item.titulo}</option>)}</select></label>
            <label><span>Título del trabajo</span><input value={portfolio.titulo} onChange={(event) => setPortfolio({ ...portfolio, titulo: event.target.value })} placeholder="Antes/después de cocina" required /></label>
            <label><span>Descripción</span><textarea value={portfolio.descripcion} onChange={(event) => setPortfolio({ ...portfolio, descripcion: event.target.value })} placeholder="Describe el resultado o contexto del trabajo." /></label>
            <label className="fileDrop"><ImagePlus /><span>{portfolio.imagen ? portfolio.imagen.name : "Seleccionar foto"}</span><input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={(event) => setPortfolio({ ...portfolio, imagen: event.target.files?.[0] ?? null })} /></label>
            <button className="darkButton" disabled={uploading || !publications.length}>{uploading ? "Subiendo..." : "Subir trabajo"}</button>
          </form>

          <section className="myPublicationsCard">
            <span className="sectionKicker"><CheckCircle2 size={16} /> Tus publicaciones</span>
            {publications.slice(0, 6).map((item) => <article className="publicationManageItem" key={item.id}><div><strong>{item.titulo}</strong><span>{item.categoria} · {item.estado_revision ?? "aprobada"} · {item.activa ? "Activa" : "Inactiva"}</span>{item.comentario_revision ? <small>{item.comentario_revision}</small> : null}</div><div><button type="button" onClick={() => startEdit(item)}>Editar</button><button type="button" onClick={() => void handleToggle(item.id)}>{item.activa ? "Desactivar" : "Activar"}</button></div></article>)}
            {!publications.length ? <p>Aún no tienes publicaciones.</p> : null}
          </section>
        </aside>
      </section>
    </main>
  );
}
