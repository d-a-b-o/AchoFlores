import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api, formatPEN, imageSrc, type Quote } from "../api";
import { useCart } from "../cart";

export function Cart() {
  const { items, setQuantity, remove } = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");

  // El servidor recalcula precios, precio por mayor y stock en cada cambio del carrito.
  useEffect(() => {
    if (!items.length) return;
    let alive = true;
    api<Quote>("/cart/quote", { method: "POST", json: { items } })
      .then((q) => alive && (setQuote(q), setError("")))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [items]);

  if (!items.length)
    return (
      <section className="card narrow">
        <h1>Tu carrito está vacío</h1>
        <Link to="/" className="btn">
          Ver catálogo
        </Link>
      </section>
    );

  return (
    <section>
      <h1>Carrito</h1>
      {error && <p role="alert" className="alert alert-error">{error}</p>}
      {quote?.warnings.map((w) => (
        <p key={w} role="status" className="alert alert-info">
          {w}
        </p>
      ))}
      {quote?.stalls.map((g) => (
        <article key={g.stall.id} className="card cart-group">
          <h2>
            {g.stall.name} · Puesto {g.stall.number}
          </h2>
          <ul className="list">
            {g.lines.map((l) => (
              <li key={l.productId} className="cart-line">
                <img src={imageSrc(l.imageUrl)} alt="" width={56} height={56} />
                <div>
                  <strong>{l.name}</strong>
                  <span className="muted">
                    {formatPEN(l.unitPriceCents / 100)} c/u{l.wholesaleApplied && " · precio por mayor"}
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  value={l.quantity}
                  aria-label={`Cantidad de ${l.name}`}
                  onChange={(e) => setQuantity(l.productId, Number(e.target.value))}
                />
                <span className="price">{formatPEN(l.lineTotalCents / 100)}</span>
                <button className="link" onClick={() => remove(l.productId)} aria-label={`Quitar ${l.name}`}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
          <p className="subtotal">Subtotal del puesto: {formatPEN(g.subtotalCents / 100)}</p>
        </article>
      ))}
      {quote && (
        <section className="card total">
          <strong>Total: {formatPEN(quote.totalCents / 100)}</strong>
          <span className="muted">El pago en línea y el delivery llegan en el próximo sprint.</span>
        </section>
      )}
    </section>
  );
}
