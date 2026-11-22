import { Link } from "react-router";
import { formatPEN, imageSrc, type CatalogProduct, type Product } from "../api";
import { useCart } from "../cart";
import { CATEGORY_LABELS } from "../routes";

export function ProductCard({ product, showStall = true }: { product: CatalogProduct | Product; showStall?: boolean }) {
  const { add } = useCart();
  const out = product.stock === 0;
  const stall = "stall" in product ? product.stall : null;
  return (
    <li className={`product ${out ? "is-off" : ""}`}>
      <img src={imageSrc(product.imageUrl)} alt={product.name} loading="lazy" />
      <div className="product-body">
        <strong>{product.name}</strong>
        <span className="muted">{CATEGORY_LABELS[product.category] ?? product.category}</span>
        <span className="price">{formatPEN(product.price)}</span>
        {product.wholesalePrice != null && (
          <span className="badge">
            {formatPEN(product.wholesalePrice)} c/u desde {product.wholesaleMinQty} u.
          </span>
        )}
        {showStall && stall && (
          <Link to={`/puestos/${stall.id}`} className="muted small">
            {stall.name} · Puesto {stall.number}
          </Link>
        )}
        <button className="btn btn-small" disabled={out} onClick={() => add(product.id)} aria-label={`Agregar ${product.name} al carrito`}>
          {out ? "Agotado" : "Agregar"}
        </button>
      </div>
    </li>
  );
}
