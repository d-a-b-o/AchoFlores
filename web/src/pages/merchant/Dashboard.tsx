import { useEffect, useState } from "react";
import { api, type Product, type Stall } from "../../api";
import { StallForm } from "./StallForm";
import { ProductForm } from "./ProductForm";
import { ProductList } from "./ProductList";
import { MerchantOrders } from "./Orders";

const STATUS_TEXT = {
  PENDING: "Pendiente de aprobación por la administración del mercado.",
  APPROVED: "Aprobado: tus productos son visibles para los clientes.",
  REJECTED: "Rechazado.",
};

export function MerchantDashboard() {
  const [stall, setStall] = useState<Stall | null | undefined>(undefined);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    api<Stall>("/stalls/me")
      .then(setStall)
      .catch(() => setStall(null));
  }, []);

  useEffect(() => {
    if (stall?.status === "APPROVED") api<Product[]>("/products/mine").then(setProducts);
  }, [stall?.status]);

  if (stall === undefined) return <p className="muted">Cargando…</p>;
  if (stall === null) return <StallForm onCreated={setStall} />;

  return (
    <>
      <section className={`card status status-${stall.status.toLowerCase()}`}>
        <h1>
          {stall.name} · Puesto {stall.number}
        </h1>
        <p>
          Pabellón {stall.pavilion} · {stall.schedule}
        </p>
        <p>
          <strong>{STATUS_TEXT[stall.status]}</strong> {stall.rejectionReason && `Motivo: ${stall.rejectionReason}`}
        </p>
      </section>
      {stall.status === "APPROVED" && <MerchantOrders />}
      {stall.status === "APPROVED" && (
        <div className="split">
          <ProductForm onCreated={(p) => setProducts((ps) => [p, ...ps])} />
          <section>
            <h2>Mis productos</h2>
            <ProductList products={products} onChange={(p) => setProducts((ps) => ps.map((x) => (x.id === p.id ? p : x)))} />
          </section>
        </div>
      )}
    </>
  );
}
