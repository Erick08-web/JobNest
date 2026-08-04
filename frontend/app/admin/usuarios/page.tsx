"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Power, Search, UsersRound } from "lucide-react";
import { AdminAlert, AdminBadge, AdminButton, AdminCard, AdminEmptyState, AdminPageHeader, AdminSearch, AdminSectionTitle, AdminSelect, AdminShell, AdminSkeleton, AdminToolbar, formatAdminDate, humanizeAdminText, statusTone } from "../components/AdminUI";
import { fetchCurrentUser, listAdminUsers, toggleAdminUser, type AdminUser } from "../../lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("todos");
  const [status, setStatus] = useState("todos");
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
      setMessage(err instanceof Error ? err.message : "No pudimos cargar la información. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users.filter((item) => {
      const matchesTerm = !term || `${item.nombre} ${item.email} ${item.tipo_usuario}`.toLowerCase().includes(term);
      const matchesRole = role === "todos" || item.tipo_usuario === role;
      const matchesStatus = status === "todos" || (status === "activo" ? item.activo : !item.activo);
      return matchesTerm && matchesRole && matchesStatus;
    });
  }, [query, role, status, users]);

  const toggleUser = async (id: number, active: boolean) => {
    if (!window.confirm(`¿Confirmas ${active ? "desactivar" : "activar"} esta cuenta?`)) return;
    setWorkingId(id);
    setMessage("");
    try {
      const result = await toggleAdminUser(id);
      setMessage(result.message || "Usuario actualizado.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No pudimos completar la acción. Inténtalo nuevamente.");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <AdminShell title="Usuarios" description="Directorio de clientes, prestadores y administradores.">
      <AdminPageHeader eyebrow="Cuentas" title="Usuarios registrados" description="Consulta roles, estado de acceso y actividad básica sin mostrar datos internos como protagonistas." icon={UsersRound} />
      {message ? <AdminAlert tone={message.includes("actualizado") ? "success" : "danger"}>{message}</AdminAlert> : null}
      {loading ? <AdminSkeleton rows={5} /> : (
        <AdminCard>
          <AdminSectionTitle eyebrow="Directorio" title={`${filteredUsers.length} cuentas`} />
          <AdminToolbar>
            <AdminSearch value={query} onChange={setQuery} placeholder="Buscar por nombre, correo o rol" />
            <AdminSelect value={role} onChange={setRole} label="Rol">
              <option value="todos">Todos</option>
              <option value="cliente">Cliente</option>
              <option value="prestador">Prestador</option>
              <option value="administrador">Administrador</option>
            </AdminSelect>
            <AdminSelect value={status} onChange={setStatus} label="Estado">
              <option value="todos">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </AdminSelect>
          </AdminToolbar>
          <div className="adminList">
            {filteredUsers.map((item) => (
              <article className="adminRow" key={item.id}>
                <div className="adminRowMain">
                  <strong>{item.nombre || "Sin nombre registrado"}</strong>
                  <span>{item.email}</span>
                  <span>Registro: {formatAdminDate(item.creado_en, true)} · Último acceso: {item.ultimo_login ? formatAdminDate(item.ultimo_login, true) : "Sin acceso reciente"}</span>
                </div>
                <AdminBadge tone={statusTone(item.tipo_usuario)}>{humanizeAdminText(item.tipo_usuario)}</AdminBadge>
                <AdminBadge tone={statusTone(item.activo)}>{item.activo ? "Activo" : "Inactivo"}</AdminBadge>
                <Link className="adminButton" href={`/admin/usuarios/${item.id}`}>
                  <Eye size={16} /> Ver usuario
                </Link>
                <AdminButton type="button" tone={item.activo ? "danger" : "success"} onClick={() => void toggleUser(item.id, item.activo)} disabled={workingId === item.id}>
                  <Power size={16} /> {item.activo ? "Desactivar" : "Activar"}
                </AdminButton>
              </article>
            ))}
            {!filteredUsers.length ? <AdminEmptyState icon={Search} title="No se encontraron usuarios" description="Ajusta la búsqueda o limpia los filtros para ver más cuentas." /> : null}
          </div>
        </AdminCard>
      )}
    </AdminShell>
  );
}
