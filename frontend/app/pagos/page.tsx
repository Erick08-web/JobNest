"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, CalendarDays, CheckCircle2, CreditCard, Download, LockKeyhole, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
import { fetchCurrentUser, listPendingPayments, processPayment, type CurrentUser, type PendingPayment } from "../lib/api";

function money(value: number) {
  return `$${value.toLocaleString("es-MX")}`;
}

export default function PaymentsPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [method, setMethod] = useState<"efectivo" | "tarjeta">("efectivo");
  const [card, setCard] = useState({ numero: "", nombre: "", expiracion: "", cvv: "" });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const current = await fetchCurrentUser();
      if (!current) throw new Error("Inicia sesión para ver pagos.");
      setUser(current);
      if (current.tipo_usuario !== "cliente") {
        setPayments([]);
        setMessage("Los pagos se realizan desde una cuenta de cliente.");
        return;
      }
      const items = await listPendingPayments();
      setPayments(items);
      setSelectedId((currentSelected) => currentSelected ?? items[0]?.id ?? null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible cargar pagos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const selected = payments.find((payment) => payment.id === selectedId) ?? null;
  const total = useMemo(() => payments.reduce((sum, payment) => sum + Number(payment.precio || 0), 0), [payments]);

  const handlePayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setProcessing(true);
    setMessage("");
    try {
      const result = await processPayment({ solicitud_id: selected.id, metodo: method, monto: selected.precio, ...card });
      setMessage(result.message || "Pago registrado correctamente.");
      setCard({ numero: "", nombre: "", expiracion: "", cvv: "" });
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No fue posible procesar el pago.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="paymentsPage">
      <header className="moduleTopbar"><Link href="/cliente" className="backLink"><ArrowLeft size={18} /> Volver</Link><strong>Pagos</strong></header>
      <section className="paymentsHero">
        <div><span className="sectionKicker">Centro financiero real</span><h1>Pagos conectados a tus solicitudes aceptadas.</h1><p>Solo aparecen servicios aceptados que aún no tienen pago completado en la base de datos.</p></div>
        <aside className="walletCard"><span>JobNest Wallet</span><strong>{money(total)}</strong><p>Pendiente por confirmar</p><div><LockKeyhole size={18} /> Pago protegido</div></aside>
      </section>

      <section className="paymentsWorkspace">
        <div className="paymentStats">
          <article><WalletCards /><strong>{money(total)}</strong><span>Total pendiente</span></article>
          <article><CreditCard /><strong>{payments.length}</strong><span>Pagos por realizar</span></article>
          <article><ReceiptText /><strong>{user?.tipo_usuario === "cliente" ? "Activo" : "No disponible"}</strong><span>Estado de cuenta</span></article>
        </div>

        {message ? <div className="formAlert moduleAlert">{message}</div> : null}

        <section className="paymentTimeline">
          <div className="sectionTitleRow"><div><span className="sectionKicker">Movimientos reales</span><h2>Servicios aceptados</h2></div><button type="button" onClick={() => void load()}>Actualizar</button></div>
          {loading ? <div className="portfolioEmpty"><CreditCard size={30} /><h3>Cargando pagos...</h3></div> : null}
          {!loading && !payments.length ? <div className="portfolioEmpty"><CheckCircle2 size={30} /><h3>No tienes pagos pendientes</h3><p>Cuando un prestador acepte una solicitud, aparecerá aquí.</p></div> : null}
          {payments.map((payment) => (
            <article className={selectedId === payment.id ? "paymentItem selected" : "paymentItem"} key={payment.id} onClick={() => setSelectedId(payment.id)}>
              <div className="paymentIcon"><CreditCard size={20} /></div>
              <div><strong>{payment.titulo}</strong><p>{payment.prestador_nombre} · {payment.fecha_servicio || "Fecha pendiente"}</p></div>
              <span className="paymentStatus pendiente">Pendiente</span>
              <strong>{money(payment.precio)}</strong>
              <button type="button"><Download size={17} /> Detalle</button>
            </article>
          ))}
        </section>

        <aside className="paymentTrustPanel">
          <article><ShieldCheck /><h3>Registrar pago</h3><p>{selected ? `Servicio seleccionado: ${selected.titulo}` : "Selecciona una solicitud aceptada para pagar."}</p></article>
          {selected ? (
            <form className="paymentForm" onSubmit={handlePayment}>
              <label><span>Método</span><select value={method} onChange={(event) => setMethod(event.target.value as "efectivo" | "tarjeta")}><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option></select></label>
              {method === "tarjeta" ? (
                <>
                  <label><span>Nombre del titular</span><input value={card.nombre} onChange={(event) => setCard({ ...card, nombre: event.target.value })} placeholder="Nombre completo" /></label>
                  <label><span>Número</span><input value={card.numero} onChange={(event) => setCard({ ...card, numero: event.target.value })} placeholder="4242 4242 4242 4242" /></label>
                  <div className="paymentMiniGrid"><label><span>Expira</span><input value={card.expiracion} onChange={(event) => setCard({ ...card, expiracion: event.target.value })} placeholder="MM/AA" /></label><label><span>CVV</span><input value={card.cvv} onChange={(event) => setCard({ ...card, cvv: event.target.value })} placeholder="123" /></label></div>
                </>
              ) : null}
              <button className="submitButton" disabled={processing}>{processing ? "Procesando..." : `Pagar ${money(selected.precio)}`}</button>
            </form>
          ) : null}
          <article><BadgeCheck /><h3>Recibos claros</h3><p>Después del pago, Flask registra el movimiento en la tabla de pagos.</p></article>
          <article><CalendarDays /><h3>Pagos por servicio</h3><p>Cada pago está asociado a una solicitud aceptada.</p></article>
        </aside>
      </section>
    </main>
  );
}
