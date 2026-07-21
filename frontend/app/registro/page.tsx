"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BriefcaseBusiness, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { loginUser, registerUser } from "../lib/api";

type Role = "cliente" | "prestador";

export default function RegisterPage() {
  const [role, setRole] = useState<Role>("cliente");
  const [form, setForm] = useState({ firstName: "", lastNameP: "", lastNameM: "", candidatePhone: "", email: "", password: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const update = (name: keyof typeof form, value: string) => setForm((current) => ({ ...current, [name]: value }));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setFieldErrors({});
    try {
      await registerUser({ ...form, userType: role });
      await loginUser(form.email, form.password).catch(() => null);
      window.location.href = role === "prestador" ? "/profesional" : "/cliente";
    } catch (error) {
      const data = (error as Error & { data?: { errors?: Record<string, string>; message?: string } }).data;
      setFieldErrors(data?.errors ?? {});
      setMessage(data?.message || (error instanceof Error ? error.message : "No fue posible registrar la cuenta."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="authPage registerPage">
      <Link href="/" className="authBrand">JobNest</Link>
      <section className="authShell wideAuth">
        <aside className="authStory">
          <span className="eyebrow"><ShieldCheck size={16} /> Cuenta real</span>
          <h1>Crea una cuenta lista para contratar o publicar servicios.</h1>
          <p>El registro guarda tu usuario en la misma base de datos del proyecto Flask actual, pero con la experiencia visual de JobNest V2.</p>
          <div className="rolePreview"><span className={role === "cliente" ? "active" : ""}>Cliente</span><span className={role === "prestador" ? "active" : ""}>Profesional</span></div>
        </aside>
        <form className="authCard registerCard" onSubmit={handleSubmit}>
          <div>
            <span className="sectionKicker">Registro</span>
            <h2>Elige tu tipo de cuenta</h2>
          </div>
          <div className="roleSelector">
            <button type="button" className={role === "cliente" ? "selected" : ""} onClick={() => setRole("cliente")}><UserRound />Cliente<span>Busco contratar servicios</span></button>
            <button type="button" className={role === "prestador" ? "selected" : ""} onClick={() => setRole("prestador")}><BriefcaseBusiness />Profesional<span>Quiero publicar mis servicios</span></button>
          </div>
          {message ? <div className="formAlert">{message}</div> : null}
          <div className="formGrid">
            <label className="fieldGroup"><span>Nombre</span><div><UserRound size={18} /><input value={form.firstName} onChange={(event) => update("firstName", event.target.value)} required /></div><small>{fieldErrors.firstName}</small></label>
            <label className="fieldGroup"><span>Apellido paterno</span><div><input value={form.lastNameP} onChange={(event) => update("lastNameP", event.target.value)} required /></div><small>{fieldErrors.lastNameP}</small></label>
            <label className="fieldGroup"><span>Apellido materno</span><div><input value={form.lastNameM} onChange={(event) => update("lastNameM", event.target.value)} required /></div><small>{fieldErrors.lastNameM}</small></label>
            <label className="fieldGroup"><span>Teléfono</span><div><Phone size={18} /><input value={form.candidatePhone} onChange={(event) => update("candidatePhone", event.target.value)} /></div><small>{fieldErrors.candidatePhone}</small></label>
            <label className="fieldGroup fullField"><span>Correo electrónico</span><div><Mail size={18} /><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required /></div><small>{fieldErrors.email}</small></label>
            <label className="fieldGroup"><span>Contraseña</span><div><input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} required /></div><small>{fieldErrors.password}</small></label>
            <label className="fieldGroup"><span>Confirmar contraseña</span><div><input type="password" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} required /></div><small>{fieldErrors.confirmPassword}</small></label>
          </div>
          <button className="submitButton" disabled={loading}>{loading ? "Creando cuenta..." : "Crear cuenta"}<ArrowRight size={18} /></button>
          <p className="authSwitch">¿Ya tienes cuenta? <Link href="/login">Iniciar sesión</Link></p>
        </form>
      </section>
    </main>
  );
}
