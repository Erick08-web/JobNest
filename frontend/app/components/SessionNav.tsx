"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOut, Search, UserRound } from "lucide-react";
import { fetchCurrentUser, logoutUser, type CurrentUser } from "../lib/api";

export function SessionNav() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchCurrentUser()
      .then((currentUser) => {
        if (mounted) setUser(currentUser);
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const dashboardHref = user?.tipo_usuario === "prestador" ? "/profesional" : "/cliente";

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    window.location.href = "/";
  };

  return (
    <header className="siteNav">
      <Link href="/" className="brand" aria-label="JobNest inicio">
        <Image src="/images/logo.jpeg" alt="JobNest" width={38} height={38} />
        <span>JobNest</span>
      </Link>
      <nav className="navLinks" aria-label="Navegación principal">
        <Link href="/buscar">Buscar</Link>
        <Link href="/#categorias">Categorías</Link>
        <Link href="/mensajes">Mensajes</Link>
        <Link href="/pagos">Pagos</Link>
      <Link href="/resenas">Reseñas</Link>
      <Link href="/cuenta">Cuenta</Link>
      </nav>
      <div className="navActions">
        {loaded && user ? (
          <>
            <Link href={dashboardHref} className="ghostButton"><UserRound size={17} /> {user.nombres || "Mi cuenta"}</Link>
            <button className="navIconButton" onClick={handleLogout} aria-label="Cerrar sesión"><LogOut size={18} /></button>
          </>
        ) : (
          <>
            <Link href="/login" className="ghostButton">Iniciar sesión</Link>
            <Link href="/registro" className="primaryButton">Registrarse</Link>
          </>
        )}
      </div>
    </header>
  );
}

export function CompactDashboardRail({ role }: { role: "cliente" | "prestador" }) {
  const home = role === "prestador" ? "/profesional" : "/cliente";
  return (
    <aside className="dashboardRail">
      <strong>{role === "prestador" ? "JobNest Pro" : "JobNest"}</strong>
      <Link href={home}>Inicio</Link>
      <Link href="/buscar"><Search size={16} /> Buscar</Link>
      <Link href="/solicitudes">Solicitudes</Link>
      <Link href="/mensajes">Mensajes</Link>
      <Link href="/pagos">Pagos</Link>
      <Link href="/resenas">Reseñas</Link>
      <Link href="/cuenta">Cuenta</Link>
      {role === "prestador" ? <Link href="/publicar">Publicar</Link> : null}
      {role === "prestador" ? <Link href="/agenda">Agenda</Link> : null}
    </aside>
  );
}
