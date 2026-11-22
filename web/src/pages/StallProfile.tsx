import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { api, type Product } from "../api";
import { ProductCard } from "../components/ProductCard";

interface PublicStall {
  id: string;
  name: string;
  number: string;
  pavilion: string;
  schedule: string;
  products: Product[];
}

export function StallProfile() {
  const { id } = useParams();
  const [stall, setStall] = useState<PublicStall | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<PublicStall>(`/catalog/stalls/${encodeURIComponent(id ?? "")}`)
      .then(setStall)
      .catch((e) => setError((e as Error).message));
  }, [id]);

  if (error) return <p role="alert" className="alert alert-error">{error}</p>;
  if (!stall) return <p className="muted">Cargando…</p>;

  return (
    <>
      <section className="card">
        <h1>{stall.name}</h1>
        <p>
          Puesto {stall.number} · Pabellón {stall.pavilion} · Mercado de Flores de Acho, Rímac
        </p>
        <p className="muted">Horario: {stall.schedule}</p>
      </section>
      <h2>Productos</h2>
      {stall.products.length ? (
        <ul className="product-grid">
          {stall.products.map((p) => (
            <ProductCard key={p.id} product={p} showStall={false} />
          ))}
        </ul>
      ) : (
        <p className="muted">Este puesto aún no publica productos.</p>
      )}
    </>
  );
}
