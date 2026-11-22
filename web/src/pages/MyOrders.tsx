import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api, formatPEN, ORDER_STATUS_LABEL, type Checkout } from "../api";

const STEPS = ["PAID", "PREPARING", "READY", "SHIPPED", "DELIVERED"] as const;

// HU-17: seguimiento del pedido con su historial.
export function MyOrders() {
  const [checkouts, setCheckouts] = useState<Checkout[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Checkout[]>("/orders").then(setCheckouts).catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <p role="alert" className="alert alert-error">{error}</p>;
  if (!checkouts) return <p className="muted">Cargando…</p>;
  if (!checkouts.length)
    return (
      <section className="card narrow">
        <h1>Aún no tienes pedidos</h1>
        <Link className="btn" to="/">
          Ver catálogo
        </Link>
      </section>
    );

  return (
    <section>
      <h1>Mis pedidos</h1>
      <ul className="list">
        {checkouts.map((c) => (
          <li key={c.id} className="card">
            <div className="row between">
              <strong>Pedido {c.id.slice(-8).toUpperCase()}</strong>
              <span className="price">{formatPEN(c.totalCents / 100)}</span>
            </div>
            {c.status === "PENDING_PAYMENT" && (
              <Link to={`/pasarela/${c.id}`} className="alert alert-error">
                Pago pendiente: completar pago
              </Link>
            )}
            {c.scheduledFor && <span className="badge">Programado para el {c.scheduledFor.slice(0, 10)}</span>}
            {c.orders.map((o) => (
              <article key={o.id} className="track">
                <div className="row between">
                  <span>
                    {o.stall.name} · Puesto {o.stall.number}
                  </span>
                  <span className={`status-chip s-${o.status.toLowerCase()}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                </div>
                <span className="muted">{o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</span>
                <ol className="steps-bar" aria-label="Progreso del pedido">
                  {STEPS.filter((s) => c.fulfillment === "DELIVERY" || s !== "SHIPPED").map((s) => (
                    <li key={s} className={o.events?.some((e) => e.status === s) ? "done" : ""}>
                      {ORDER_STATUS_LABEL[s]}
                    </li>
                  ))}
                </ol>
                <details>
                  <summary>Historial</summary>
                  <ol className="history">
                    {o.events?.map((e) => (
                      <li key={e.id}>
                        {ORDER_STATUS_LABEL[e.status]} — {new Date(e.createdAt).toLocaleString("es-PE")}
                      </li>
                    ))}
                  </ol>
                </details>
              </article>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
