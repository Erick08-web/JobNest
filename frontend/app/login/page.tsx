"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Eye, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { fetchCurrentUser, loginUser } from "../lib/api";

function dashboardForRole(role?: string) {
  if (role === "administrador") return "/admin";
  if (role === "prestador") return "/profesional";
  return "/cliente";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await loginUser(email, password);
      const user = await fetchCurrentUser();
      window.location.href = dashboardForRole(user?.tipo_usuario);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="authPage">
      <Link href="/" className="authBrand">JobNest</Link>
      <section className="authShell">
        <aside className="authStory">
          <span className="eyebrow"><Sparkles size={16} /> JobNest V2</span>
          <h1>Entra a tu espacio de confianza profesional.</h1>
          <p>Continúa solicitudes, conversaciones, pagos y publicaciones desde una experiencia limpia y enfocada.</p>
          <div className="authTrustCard"><ShieldCheck /><strong>Sesión conectada a tu base de datos real.</strong><span>Usa el mismo usuario que ya tenías en JobNest.</span></div>
        </aside>
        <form className="authCard" onSubmit={handleSubmit}>
          <div>
            <span className="sectionKicker">Iniciar sesión</span>
            <h2>Bienvenido de nuevo</h2>
            <p>Accede con tu correo y contraseña.</p>
          </div>
          {message ? <div className="formAlert">{message}</div> : null}
          <label className="fieldGroup"><span>Correo electrónico</span><div><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" required /></div></label>
          <label className="fieldGroup"><span>Contraseña</span><div><LockKeyhole size={18} /><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Mostrar contraseña"><Eye size={18} /></button></div></label>
          <button className="submitButton" disabled={loading}>{loading ? "Entrando..." : "Entrar a JobNest"}<ArrowRight size={18} /></button>
          <p className="authSwitch">¿No tienes cuenta? <Link href="/registro">Crear cuenta</Link></p>
        </form>
      </section>
    </main>
  );
}
