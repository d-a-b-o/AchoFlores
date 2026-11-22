import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { api, formatPEN, ORDER_STATUS_LABEL, type Checkout } from "../api";

export function PurchaseResult() {
  const { id = "" } = useParams();
  const [c, setC] = useState<Checkout | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Checkout>(`/checkout/${encodeURIComponent(id)}`).then(setC).catch((e) => setError((e as Error).message));
  }, [id]);

  if (error) return <p role="alert" className="alert alert-error">{error}</p>;
  if (!c) return <p className="muted">Cargando…</p>;

  return (
    <section className="card narrow">
      {c.status === "PAID" ? (
        <>
          <h1>¡Pago confirmado!</h1>
          <p>Tu pedido N.º {c.id.slice(-8).toUpperCase()} ya está en los puestos.</p>
        </>
      ) : c.status === "FAILED" ? (
        <>
          <h1>No pudimos completar tu compra</h1>
          <p role="alert" className="alert alert-error">{c.failureReason}</p>
        </>
      ) : (
        <>
          <h1>Pago pendiente</h1>
          <p role="alert" className="alert alert-error">{c.failureReason ?? "Aún no recibimos la confirmación del pago."}</p>
          <Link className="btn" to={`/pasarela/${c.id}`}>
            Reintentar pago
          </Link>
        </>
      )}
      <ul className="list">
        {c.orders.map((o) => (
          <li key={o.id}>
            <strong>
              {o.stall.name} · Puesto {o.stall.number}
            </strong>{" "}
            <span className="muted">— {ORDER_STATUS_LABEL[o.status]}</span>
            <span className="muted">{o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</span>
          </li>
        ))}
      </ul>
      <p className="muted">
        {c.fulfillment === "DELIVERY" ? `Delivery a ${c.district}: ${formatPEN(c.deliveryFeeCents / 100)}` : "Recojo en el puesto"}
      </p>
      <p className="total">
        <strong>Total: {formatPEN(c.totalCents / 100)}</strong>
      </p>
    </section>
  );
}
