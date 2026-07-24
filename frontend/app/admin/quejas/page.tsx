"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { CompactDashboardRail } from "../../components/SessionNav";
import { fetchCurrentUser, listAdminComplaints, resolveAdminComplaint, type AdminComplaint } from "../../lib/api";

function statusClass(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

export default function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState<AdminComplaint[]>([]);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const current = await fetchCurrentUser();
      if (!current || current.tipo_usuario !== "administrador") throw new Error("Acceso reservado para administradores.");
      setComplaints(await listAdminComplaints());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible cargar quejas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const updateComplaint = async (id: number, estado: "en_revision" | "resuelta") => {
    setWorkingId(`${id}-${estado}`);
    setMessage("");
    try {
      const result = await resolveAdminComplaint(id, { estado, respuesta: reply });
      setMessage(result.message || "Queja actualizada.");
      setReply("");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible actualizar la queja.");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <main className="dashboardV2 adminDashboard">
      <CompactDashboardRail role="administrador" />
      <section className="dashboardCanvas">
        <header className="adminSectionHeader">
          <div><span className="sectionKicker"><AlertTriangle size={16} /> Atención</span><h1>Quejas</h1><p>Reportes enviados por clientes y prestadores para seguimiento administrativo.</p></div>
          <Link href="/admin">Resumen</Link>
        </header>

        {message ? <div className="formAlert moduleAlert">{message}</div> : null}
        {loading ? <div className="portfolioEmpty"><Search size={30} /><h3>Cargando quejas...</h3></div> : null}

        <section className="dashPanel adminTablePanel">
          <div className="sectionTitleRow"><div><span className="sectionKicker">Bandeja</span><h2>Seguimiento de quejas</h2></div></div>
          <textarea className="adminReviewNote" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Respuesta o acción tomada por administración" />
          <div className="adminTable compact">
            {complaints.map((item) => (
              <article className="adminTableRow complaintRow" key={item.id}>
                <div><strong>{item.motivo}</strong><span>{item.usuario_nombre} · {item.tipo_usuario} · {item.descripcion}</span></div>
                <span className={`statusPill ${statusClass(item.estado)}`}>{item.estado}</span>
                <button type="button" onClick={() => void updateComplaint(item.id, "en_revision")} disabled={workingId === `${item.id}-en_revision`}>Revisar</button>
                <button type="button" onClick={() => void updateComplaint(item.id, "resuelta")} disabled={workingId === `${item.id}-resuelta`}>Resolver</button>
              </article>
            ))}
            {!complaints.length ? <p className="mutedPanelText">Aún no hay quejas.</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
