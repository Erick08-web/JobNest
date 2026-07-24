"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CreditCard, Search } from "lucide-react";
import { CompactDashboardRail } from "../../components/SessionNav";
import { fetchCurrentUser, listAdminPayments, type AdminPayment } from "../../lib/api";

function money(value: number) {
  return `$${value.toLocaleString("es-MX")}`;
}

function statusClass(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

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
      setMessage(err instanceof Error ? err.message : "No fue posible cargar pagos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <main className="dashboardV2 adminDashboard">
      <CompactDashboardRail role="administrador" />
      <section className="dashboardCanvas">
        <header className="adminSectionHeader">
          <div><span className="sectionKicker"><CreditCard size={16} /> Pagos</span><h1>Control de pagos</h1><p>Consulta pagos internos registrados, su estado y el servicio relacionado.</p></div>
          <Link href="/admin">Resumen</Link>
        </header>

        {message ? <div className="formAlert moduleAlert">{message}</div> : null}
        {loading ? <div className="portfolioEmpty"><Search size={30} /><h3>Cargando pagos...</h3></div> : null}

        <section className="dashPanel adminTablePanel">
          <div className="sectionTitleRow">
            <div><span className="sectionKicker">Registros</span><h2>{total} pagos encontrados</h2></div>
            <button type="button" className="smallGhostButton" onClick={() => void load()}>Buscar</button>
          </div>
          <div className="adminFiltersRow">
            <label className="adminSearch wide"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cliente, prestador, referencia o publicación" /></label>
            <select className="adminFilter" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="completado">Completado</option>
              <option value="rechazado">Rechazado</option>
              <option value="cancelado">Cancelado</option>
              <option value="reembolsado">Reembolsado</option>
            </select>
          </div>
          <div className="adminTable compact adminSpacedTable">
            {payments.map((item) => (
              <article className="adminTableRow paymentRow" key={item.id}>
                <div><strong>{money(item.monto)} {item.moneda}</strong><span>{item.publicacion_titulo || "Servicio"} · Solicitud #{item.solicitud_id ?? "-"}</span></div>
                <span className={`statusPill ${statusClass(item.estado)}`}>{item.estado}</span>
                <span>{item.metodo || item.procesador}</span>
                <span>{item.creado_en}</span>
              </article>
            ))}
            {!payments.length && !loading ? <p className="mutedPanelText">No hay pagos con esos filtros.</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
