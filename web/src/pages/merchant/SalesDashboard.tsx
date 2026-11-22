import { useEffect, useState } from "react";
import { api, formatPEN, type SalesSummary } from "../../api";

// HU-20: ventas por día y productos más vendidos para decidir cuánta flor comprar.
export function SalesDashboard() {
  const [data, setData] = useState<{ last7: SalesSummary; last30: SalesSummary } | null>(null);
  const [range, setRange] = useState<"last7" | "last30">("last7");

  useEffect(() => {
    api<{ last7: SalesSummary; last30: SalesSummary }>("/merchant/dashboard").then(setData).catch(() => setData(null));
  }, []);

  if (!data) return null;
  const s = data[range];
  const max = Math.max(1, ...s.byDay.map((d) => d.salesCents));

  return (
    <section className="card" aria-label="Panel de ventas">
      <div className="row between">
        <h2>Mis ventas</h2>
        <div className="row" role="group" aria-label="Periodo">
          <button className={`btn btn-small ${range === "last7" ? "" : "btn-ghost"}`} onClick={() => setRange("last7")}>
            7 días
          </button>
          <button className={`btn btn-small ${range === "last30" ? "" : "btn-ghost"}`} onClick={() => setRange("last30")}>
            30 días
          </button>
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <span className="muted">Ventas</span>
          <strong>{formatPEN(s.salesCents / 100)}</strong>
        </div>
        <div className="stat">
          <span className="muted">Pedidos</span>
          <strong>{s.orders}</strong>
        </div>
        <div className="stat">
          <span className="muted">Ticket promedio</span>
          <strong>{formatPEN(s.orders ? s.salesCents / s.orders / 100 : 0)}</strong>
        </div>
      </div>
      {s.orders === 0 ? (
        <p className="muted">Aún no tienes ventas en este periodo. Publica tus productos con buena foto y precio por mayor para atraer pedidos.</p>
      ) : (
        <>
          <h3>Ventas por día</h3>
          <ul className="bars" aria-label="Ventas por día">
            {s.byDay.map((d) => (
              <li key={d.day}>
                <span className="muted small">{d.day.slice(5)}</span>
                <span className="bar" style={{ width: `${(d.salesCents / max) * 100}%` }} />
                <span className="small">{formatPEN(d.salesCents / 100)}</span>
              </li>
            ))}
          </ul>
          <h3>Más vendidos</h3>
          <ol>
            {s.topProducts.map((p) => (
              <li key={p.name}>
                {p.name}: {p.quantity} u. · {formatPEN(p.salesCents / 100)}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
