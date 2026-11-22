import { useCallback, useEffect, useState } from "react";
import { api, formatPEN, ORDER_STATUS_LABEL, type MerchantOrder, type OrderStatus } from "../../api";

const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string }[]>> = {
  PAID: [{ status: "PREPARING", label: "Preparar" }],
  PREPARING: [{ status: "READY", label: "Marcar listo" }],
  SHIPPED: [{ status: "DELIVERED", label: "Marcar entregado" }],
};

const nextFor = (o: MerchantOrder) =>
  o.status === "READY"
    ? [o.checkout.fulfillment === "DELIVERY" ? { status: "SHIPPED" as const, label: "Enviar" } : { status: "DELIVERED" as const, label: "Entregado al cliente" }]
    : (NEXT[o.status] ?? []);

// HU-15: pedidos del puesto y cambio de estado.
export function MerchantOrders() {
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [error, setError] = useState("");
  const [date, setDate] = useState("");

  // HU-18: agenda de pedidos programados para una fecha.
  const load = useCallback(
    () => api<MerchantOrder[]>(`/merchant/orders${date ? `?date=${date}` : ""}`).then(setOrders).catch((e) => setError((e as Error).message)),
    [date],
  );
  useEffect(() => {
    load();
  }, [load]);

  async function move(o: MerchantOrder, status: OrderStatus) {
    try {
      const updated = await api<MerchantOrder>(`/merchant/orders/${o.id}/status`, { method: "PATCH", json: { status } });
      setOrders((cur) => cur.map((x) => (x.id === o.id ? updated : x)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <div className="row between">
        <h2>Pedidos</h2>
        <label className="inline">
          Agenda del día
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Agenda del día" />
        </label>
      </div>
      {error && <p role="alert" className="alert alert-error">{error}</p>}
      {!orders.length && <p className="muted">Aún no tienes pedidos pagados.</p>}
      <ul className="list">
        {orders.map((o) => (
          <li key={o.id} className="card order">
            <div className="row between">
              <strong>Pedido {o.id.slice(-6).toUpperCase()}</strong>
              <span className={`status-chip s-${o.status.toLowerCase()}`}>{ORDER_STATUS_LABEL[o.status]}</span>
            </div>
            {o.checkout.scheduledFor && <span className="badge">Programado para el {o.checkout.scheduledFor.slice(0, 10)}</span>}
            <span>{o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</span>
            <span className="muted">
              {o.checkout.customer.name} · {o.checkout.phone} ·{" "}
              {o.checkout.fulfillment === "DELIVERY" ? `Delivery a ${o.checkout.district}: ${o.checkout.address}` : "Recoge en el puesto"}
            </span>
            <span className="price">{formatPEN(o.subtotalCents / 100)}</span>
            <div className="row">
              {nextFor(o).map((n) => (
                <button key={n.status} className="btn btn-small" onClick={() => move(o, n.status)}>
                  {n.label}
                </button>
              ))}
            </div>
            <details>
              <summary>Historial</summary>
              <ol className="history">
                {o.events.map((e) => (
                  <li key={e.id}>
                    {ORDER_STATUS_LABEL[e.status]} — {new Date(e.createdAt).toLocaleString("es-PE")}
                  </li>
                ))}
              </ol>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
