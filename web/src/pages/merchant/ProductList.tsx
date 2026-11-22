import { useState } from "react";
import { api, formatPEN, imageSrc, type Product } from "../../api";
import { CATEGORY_LABELS } from "../../routes";

export function ProductList({ products, onChange }: { products: Product[]; onChange: (p: Product) => void }) {
  const [error, setError] = useState("");

  async function patch(p: Product, fields: Record<string, string>) {
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    try {
      onChange(await api<Product>(`/products/${p.id}`, { method: "PATCH", body }));
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!products.length) return <p className="muted">Todavía no publicas productos.</p>;

  return (
    <>
      {error && <p role="alert" className="alert alert-error">{error}</p>}
      <ul className="product-grid">
        {products.map((p) => (
          <li key={p.id} className={`product ${p.active && p.stock > 0 ? "" : "is-off"}`}>
            <img src={imageSrc(p.imageUrl)} alt={p.name} loading="lazy" />
            <div className="product-body">
              <strong>{p.name}</strong>
              <span className="muted">{CATEGORY_LABELS[p.category] ?? p.category}</span>
              <span className="price">{formatPEN(p.price)}</span>
              {p.wholesalePrice != null && (
                <span className="badge">
                  Mayor: {formatPEN(p.wholesalePrice)} desde {p.wholesaleMinQty} u.
                </span>
              )}
              <label className="inline">
                Stock
                <input
                  type="number"
                  min={0}
                  defaultValue={p.stock}
                  aria-label={`Stock de ${p.name}`}
                  onBlur={(e) => e.target.value !== String(p.stock) && patch(p, { stock: e.target.value })}
                />
              </label>
              <button className="btn btn-small btn-ghost" onClick={() => patch(p, { active: String(!p.active) })}>
                {p.active ? "Desactivar" : "Activar"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
