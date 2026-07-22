"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Camera, KeyRound, Mail, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { changePassword, fetchCurrentUser, updateProfile, uploadProfilePhoto, type CurrentUser } from "../lib/api";

export default function AccountPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [form, setForm] = useState({ nombres: "", apellido_paterno: "", apellido_materno: "", telefono: "" });
  const [passwords, setPasswords] = useState({ contrasena_actual: "", nueva_contrasena: "", confirmar_nueva_contrasena: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const current = await fetchCurrentUser();
      if (!current) throw new Error("Inicia sesión para administrar tu cuenta.");
      setUser(current);
      setForm({
        nombres: current.nombres || "",
        apellido_paterno: current.apellido_paterno || "",
        apellido_materno: current.apellido_materno || "",
        telefono: current.telefono || ""
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible cargar tu cuenta.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const result = await updateProfile(form);
      setMessage(result.message || "Perfil actualizado.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible actualizar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const result = await changePassword(passwords);
      setMessage(result.message || "Contraseña actualizada.");
      setPasswords({ contrasena_actual: "", nueva_contrasena: "", confirmar_nueva_contrasena: "" });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible cambiar la contraseña.");
    } finally {
      setSaving(false);
    }
  };

  const savePhoto = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!photo) {
      setMessage("Selecciona una foto de perfil.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const result = await uploadProfilePhoto(photo);
      setMessage(result.message || "Foto actualizada.");
      setPhoto(null);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible subir la foto.");
    } finally {
      setSaving(false);
    }
  };

  const home = user?.tipo_usuario === "administrador" ? "/admin" : user?.tipo_usuario === "prestador" ? "/profesional" : "/cliente";

  return (
    <main className="accountPage">
      <header className="moduleTopbar"><Link href={home} className="backLink"><ArrowLeft size={18} /> Volver</Link><strong>Cuenta</strong></header>
      <section className="accountHero">
        <div>
          <span className="sectionKicker"><Sparkles size={16} /> Identidad JobNest</span>
          <h1>{user ? `Tu perfil, ${user.nombres}.` : "Tu cuenta JobNest."}</h1>
          <p>Administra tus datos personales, foto y acceso desde la nueva experiencia V2.</p>
        </div>
        <aside>
          <div className="accountAvatar">{user?.foto_perfil ? <img src={`/api/backend${user.foto_perfil}`} alt="Foto de perfil" /> : <UserRound />}</div>
          <strong>{user?.correo || "Cuenta"}</strong>
          <span>{user?.tipo_usuario || "JobNest"}</span>
        </aside>
      </section>

      {message ? <div className="formAlert accountAlert">{message}</div> : null}
      {loading ? <div className="portfolioEmpty accountAlert"><UserRound size={30} /><h3>Cargando cuenta...</h3></div> : null}

      <section className="accountGrid">
        <form className="accountCard" onSubmit={saveProfile}>
          <span className="sectionKicker"><UserRound size={16} /> Perfil</span>
          <h2>Datos personales</h2>
          <div className="formGrid">
            <label><span>Nombre</span><input value={form.nombres} onChange={(event) => setForm({ ...form, nombres: event.target.value })} required /></label>
            <label><span>Apellido paterno</span><input value={form.apellido_paterno} onChange={(event) => setForm({ ...form, apellido_paterno: event.target.value })} required /></label>
            <label><span>Apellido materno</span><input value={form.apellido_materno} onChange={(event) => setForm({ ...form, apellido_materno: event.target.value })} required /></label>
            <label><span>Teléfono</span><input value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} /></label>
          </div>
          <button className="submitButton" disabled={saving}>Guardar perfil</button>
        </form>

        <form className="accountCard" onSubmit={savePhoto}>
          <span className="sectionKicker"><Camera size={16} /> Foto</span>
          <h2>Foto de perfil</h2>
          <label className="fileDrop accountDrop"><Camera /><span>{photo ? photo.name : "Seleccionar imagen"}</span><input type="file" accept="image/png,image/jpeg,image/jpg,image/gif" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label>
          <button className="submitButton" disabled={saving}>Actualizar foto</button>
        </form>

        <form className="accountCard" onSubmit={savePassword}>
          <span className="sectionKicker"><KeyRound size={16} /> Seguridad</span>
          <h2>Contraseña</h2>
          <label><span>Contraseña actual</span><input type="password" value={passwords.contrasena_actual} onChange={(event) => setPasswords({ ...passwords, contrasena_actual: event.target.value })} required /></label>
          <label><span>Nueva contraseña</span><input type="password" value={passwords.nueva_contrasena} onChange={(event) => setPasswords({ ...passwords, nueva_contrasena: event.target.value })} required /></label>
          <label><span>Confirmar contraseña</span><input type="password" value={passwords.confirmar_nueva_contrasena} onChange={(event) => setPasswords({ ...passwords, confirmar_nueva_contrasena: event.target.value })} required /></label>
          <button className="submitButton" disabled={saving}>Cambiar contraseña</button>
        </form>

        <article className="accountCard trustAccountCard">
          <span className="sectionKicker"><ShieldCheck size={16} /> Sesión</span>
          <h2>Datos de acceso</h2>
          <p><Mail size={17} /> {user?.correo}</p>
          <p><ShieldCheck size={17} /> Tipo de cuenta: {user?.tipo_usuario}</p>
          <p><Sparkles size={17} /> Última sesión: {user?.ultima_sesion || "No disponible"}</p>
        </article>
      </section>
    </main>
  );
}
