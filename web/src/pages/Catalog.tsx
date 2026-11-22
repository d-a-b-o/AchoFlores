import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api, type CatalogPage } from "../api";
import { ProductCard } from "../components/ProductCard";
import { CATEGORY_LABELS, OCCASION_LABELS } from "../routes";

const FILTERS = ["q", "category", "occasion", "minPrice", "maxPrice"] as const;

export function Catalog() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<CatalogPage | null>(null);
  const [error, setError] = useState("");
  const query = params.toString();

  useEffect(() => {
    let alive = true;
    api<CatalogPage>(`/catalog/products${query ? `?${query}` : ""}`)
      .then((d) => alive && (setData(d), setError("")))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [query]);

  function onFilter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const next = new URLSearchParams();
    for (const k of FILTERS) {
      const v = String(f.get(k) ?? "").trim();
      if (v) next.set(k, v);
    }
    setParams(next);
  }

  const goTo = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    setParams(next);
  };

  return (
    <>
      <section className="hero">
        <h1>Flores del Mercado de Acho, sin ir al Rímac</h1>
        <p>Rosas, girasoles, arreglos y coronas a precio de mercado, directo de los puestos de Acho.</p>
        <Link className="btn btn-ghost" to="/registro?tipo=comerciante">
          Soy comerciante
        </Link>
      </section>

      <form className="filters card" onSubmit={onFilter} role="search" aria-label="Filtrar catálogo" key={query}>
        <input name="q" type="search" placeholder="Buscar: rosas, corona, girasol…" defaultValue={params.get("q") ?? ""} aria-label="Buscar" />
        <select name="category" defaultValue={params.get("category") ?? ""} aria-label="Tipo de flor">
          <option value="">Todas las flores</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select name="occasion" defaultValue={params.get("occasion") ?? ""} aria-label="Ocasión">
          <option value="">Toda ocasión</option>
          {Object.entries(OCCASION_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input name="minPrice" type="number" min="0" placeholder="S/ mín." defaultValue={params.get("minPrice") ?? ""} aria-label="Precio mínimo" />
        <input name="maxPrice" type="number" min="0" placeholder="S/ máx." defaultValue={params.get("maxPrice") ?? ""} aria-label="Precio máximo" />
        <button className="btn">Filtrar</button>
      </form>

      {error && <p role="alert" className="alert alert-error">{error}</p>}
      {data && data.total === 0 && (
        <section className="card empty">
          <p>
            <strong>No encontramos productos</strong> con esos filtros.
          </p>
          <p className="muted">
            Prueba con:{" "}
            {data.suggestions.map((s) => (
              <Link key={s} to={`/?category=${s}`} className="chip">
                {CATEGORY_LABELS[s] ?? s}
              </Link>
            ))}
          </p>
        </section>
      )}
      {data && data.total > 0 && (
        <>
          <p className="muted">{data.total} productos</p>
          <ul className="product-grid">
            {data.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ul>
          {data.pages > 1 && (
            <nav className="pager" aria-label="Paginación">
              <button className="btn btn-small btn-ghost" disabled={data.page <= 1} onClick={() => goTo(data.page - 1)}>
                Anterior
              </button>
              <span>
                Página {data.page} de {data.pages}
              </span>
              <button className="btn btn-small btn-ghost" disabled={data.page >= data.pages} onClick={() => goTo(data.page + 1)}>
                Siguiente
              </button>
            </nav>
          )}
        </>
      )}
    </>
  );
}
