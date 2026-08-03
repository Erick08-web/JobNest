"use client";

import { useEffect, useState } from "react";
import { CreditCard, RefreshCw, Search } from "lucide-react";
import { AdminAlert, AdminBadge, AdminButton, AdminCard, AdminEmptyState, AdminPageHeader, AdminSearch, AdminSectionTitle, AdminSelect, AdminShell, AdminSkeleton, AdminToolbar, formatAdminDate, formatAdminMoney, humanizeAdminText, statusTone } from "../components/AdminUI";
import { fetchCurrentUser, listAdminPayments, type AdminPayment } from "../../lib/api";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const current = await fetchCurrentUser();
      if (!current || current.tipo_usuario !== "administrador") throw new Error("Acceso reservado para administradores.");
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (status) params.set("estado", status);
      const data = await listAdminPayments(params);
      setPayments(data.pagos ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No pudimos cargar la información. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <AdminShell title="Pagos" description="Consulta de pagos internos y servicios relacionados.">
      <AdminPageHeader eyebrow="Finanzas" title="Control de pagos" description="Revisa monto, método, estado, solicitud y fecha de cada registro financiero." icon={CreditCard} actions={<AdminButton onClick={() => void load()}><RefreshCw size={16} /> Buscar</AdminButton>} />
      {message ? <AdminAlert>{message}</AdminAlert> : null}
      {loading ? <AdminSkeleton rows={5} /> : (
        <AdminCard>
          <AdminSectionTitle eyebrow="Registros" title={`${total} pagos encontrados`} />
          <AdminToolbar>
            <AdminSearch value={query} onChange={setQuery} placeholder="Cliente, prestador, referencia o publicación" />
            <AdminSelect value={status} onChange={setStatus} label="Estado">
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="completado">Completado</option>
              <option value="rechazado">Rechazado</option>
              <option value="cancelado">Cancelado</option>
              <option value="reembolsado">Reembolsado</option>
            </AdminSelect>
          </AdminToolbar>
          <div className="adminList">
            {payments.map((item) => (
              <article className="adminRow" key={item.id}>
                <div className="adminRowMain">
                  <strong>{formatAdminMoney(item.monto)} {item.moneda}</strong>
                  <span>{item.publicacion_titulo || "Servicio"} · Solicitud #{item.solicitud_id ?? "-"}</span>
                  <span>{item.metodo || item.procesador || "Sin método"} · Creado: {formatAdminDate(item.creado_en, true)}{item.pagado_en ? ` · Pagado: ${formatAdminDate(item.pagado_en, true)}` : ""}</span>
                </div>
                <AdminBadge tone={statusTone(item.estado)}>{humanizeAdminText(item.estado)}</AdminBadge>
                <AdminBadge tone={statusTone(item.estado_solicitud)}>{humanizeAdminText(item.estado_solicitud)}</AdminBadge>
              </article>
            ))}
            {!payments.length ? <AdminEmptyState icon={Search} title="No hay pagos para mostrar" description="Cuando existan pagos registrados, aparecerán aquí con estado, método y solicitud." /> : null}
          </div>
        </AdminCard>
      )}
    </AdminShell>
  );
}
