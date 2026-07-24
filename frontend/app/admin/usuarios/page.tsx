"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Power, Search, UsersRound } from "lucide-react";
import { CompactDashboardRail } from "../../components/SessionNav";
import { fetchCurrentUser, listAdminUsers, toggleAdminUser, type AdminUser } from "../../lib/api";

function statusClass(value: boolean | string) {
  if (typeof value === "boolean") return value ? "aceptada" : "rechazada";
  return value.toLowerCase().replace(/\s+/g, "-");
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const current = await fetchCurrentUser();
      if (!current || current.tipo_usuario !== "administrador") throw new Error("Acceso reservado para administradores.");
      setUsers(await listAdminUsers());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible cargar usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((item) => `${item.nombre} ${item.email} ${item.tipo_usuario}`.toLowerCase().includes(term));
  }, [query, users]);

  const toggleUser = async (id: number) => {
    setWorkingId(id);
    setMessage("");
    try {
      const result = await toggleAdminUser(id);
      setMessage(result.message || "Usuario actualizado.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible actualizar el usuario.");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <main className="dashboardV2 adminDashboard">
      <CompactDashboardRail role="administrador" />
      <section className="dashboardCanvas">
        <header className="adminSectionHeader">
          <div><span className="sectionKicker"><UsersRound size={16} /> Cuentas</span><h1>Usuarios</h1><p>Consulta clientes, prestadores, administradores y estado de acceso.</p></div>
          <Link href="/admin">Resumen</Link>
        </header>

        {message ? <div className="formAlert moduleAlert">{message}</div> : null}
        {loading ? <div className="portfolioEmpty"><Search size={30} /><h3>Cargando usuarios...</h3></div> : null}

        <section className="dashPanel adminTablePanel">
          <div className="sectionTitleRow">
            <div><span className="sectionKicker">Directorio</span><h2>Cuentas registradas</h2></div>
            <label className="adminSearch"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar usuario" /></label>
          </div>
          <div className="adminTable">
            {filteredUsers.map((item) => (
              <article className="adminTableRow" key={item.id}>
                <div><strong>{item.nombre}</strong><span>{item.email}</span></div>
                <span className={`statusPill ${item.tipo_usuario}`}>{item.tipo_usuario}</span>
                <span className={`statusPill ${statusClass(item.activo)}`}>{item.activo ? "Activo" : "Inactivo"}</span>
                <button type="button" onClick={() => void toggleUser(item.id)} disabled={workingId === item.id}><Power size={16} /> {item.activo ? "Desactivar" : "Activar"}</button>
              </article>
            ))}
            {!filteredUsers.length ? <p className="mutedPanelText">No hay usuarios con ese filtro.</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
