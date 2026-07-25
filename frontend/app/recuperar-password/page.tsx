"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { requestPasswordReset } from "../lib/api";

const successMessage = "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.";

export default function RecoverPasswordPage() {
  const [correo, setCorreo] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = correo.trim().toLowerCase();
    setCorreo(email);
    setFieldError("");
    setMessage("");
    if (!email) {
      setFieldError("El correo es obligatorio.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setFieldError("Ingresa un correo válido.");
      return;
    }
    setLoading(true);
    try {
      const response = await requestPasswordReset(email, "web");
      setMessage(response.message || successMessage);
    } catch (error) {
      const data = (error as Error & { data?: { errors?: Record<string, string>; message?: string } }).data;
      setFieldError(data?.errors?.correo || "");
      setMessage(data?.message || "No fue posible procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="authPage">
      <Link href="/" className="authBrand">JobNest</Link>
      <section className="authShell">
        <aside className="authStory">
          <span className="eyebrow"><Sparkles size={16} /> Recuperación segura</span>
          <h1>Vuelve a entrar a JobNest con seguridad.</h1>
          <p>Te enviaremos un enlace temporal. No confirmaremos públicamente si el correo existe.</p>
          <div className="authTrustCard"><ShieldCheck /><strong>Enlace de un solo uso.</strong><span>El token vence y se invalida después de cambiar la contraseña.</span></div>
        </aside>
        <form className="authCard" onSubmit={handleSubmit}>
          <div>
            <span className="sectionKicker">Recuperar contraseña</span>
            <h2>Solicita un enlace</h2>
            <p>Escribe el correo asociado a tu cuenta.</p>
          </div>
          {message ? <div className="formAlert">{message}</div> : null}
          <label className="fieldGroup"><span>Correo electrónico</span><div><Mail size={18} /><input type="email" value={correo} onChange={(event) => { setCorreo(event.target.value); setFieldError(""); }} placeholder="tu@email.com" required /></div><small>{fieldError}</small></label>
          <button className="submitButton" disabled={loading}>{loading ? "Enviando..." : "Enviar instrucciones"}<ArrowRight size={18} /></button>
          <p className="authSwitch">¿Ya tienes enlace? <Link href="/restablecer-password">Restablecer contraseña</Link></p>
          <p className="authSwitch"><Link href="/login">Volver a iniciar sesión</Link></p>
        </form>
      </section>
    </main>
  );
}
