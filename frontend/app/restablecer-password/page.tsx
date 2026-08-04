"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { resetPassword } from "../lib/api";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(token ? "" : "El enlace es inválido o ha expirado.");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!token) nextErrors.token = "El enlace es inválido o ha expirado.";
    if (!password) nextErrors.password = "La contraseña es obligatoria.";
    else if (password.length < 8) nextErrors.password = "La contraseña debe tener al menos 8 caracteres.";
    else if (password.length > 128) nextErrors.password = "La contraseña debe tener máximo 128 caracteres.";
    else if (!/[A-ZÁÉÍÓÚÑ]/.test(password)) nextErrors.password = "La contraseña debe contener al menos una letra mayúscula.";
    else if (!/\d/.test(password)) nextErrors.password = "La contraseña debe contener al menos un número.";
    else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) nextErrors.password = "La contraseña debe contener al menos un carácter especial.";
    if (!confirmation) nextErrors.password_confirmation = "Confirma tu contraseña.";
    else if (password !== confirmation) nextErrors.password_confirmation = "Las contraseñas no coinciden.";
    setErrors(nextErrors);
    setMessage("");
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const response = await resetPassword({ token, password, password_confirmation: confirmation, canal: "web" });
      setSuccess(true);
      setMessage(response.message || "Tu contraseña fue actualizada correctamente.");
      setPassword("");
      setConfirmation("");
    } catch (error) {
      const data = (error as Error & { data?: { errors?: Record<string, string>; message?: string } }).data;
      setErrors(data?.errors ?? {});
      setMessage(data?.message || "No fue posible restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="authCard" onSubmit={handleSubmit}>
      <div>
        <span className="sectionKicker">Nueva contraseña</span>
        <h2>Restablece tu acceso</h2>
        <p>Usa una contraseña nueva y segura.</p>
      </div>
      {message ? <div className="formAlert">{message}</div> : null}
      {errors.token ? <small className="fieldErrorStandalone">{errors.token}</small> : null}
      <label className="fieldGroup"><span>Nueva contraseña</span><div><LockKeyhole size={18} /><input type="password" value={password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: "" })); }} required /></div><small>{errors.password}</small></label>
      <label className="fieldGroup"><span>Confirmar contraseña</span><div><LockKeyhole size={18} /><input type="password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setErrors((current) => ({ ...current, password_confirmation: "" })); }} required /></div><small>{errors.password_confirmation}</small></label>
      <button className="submitButton" disabled={loading || success}>{loading ? "Guardando..." : "Guardar contraseña"}<ArrowRight size={18} /></button>
      <p className="authSwitch"><Link href="/recuperar-password">Solicitar un nuevo enlace</Link></p>
      <p className="authSwitch"><Link href="/login">Volver a iniciar sesión</Link></p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="authPage">
      <Link href="/" className="authBrand">JobNest</Link>
      <section className="authShell">
        <aside className="authStory">
          <span className="eyebrow"><Sparkles size={16} /> Enlace seguro</span>
          <h1>Crea una contraseña nueva para tu cuenta.</h1>
          <p>El enlace solo puede utilizarse una vez y caduca automáticamente.</p>
          <div className="authTrustCard"><ShieldCheck /><strong>Sesiones protegidas.</strong><span>Al cambiar tu contraseña se cerrarán accesos anteriores por seguridad.</span></div>
        </aside>
        <Suspense fallback={<div className="authCard">Cargando...</div>}>
          <ResetPasswordContent />
        </Suspense>
      </section>
    </main>
  );
}
