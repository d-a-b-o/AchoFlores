import { useEffect, useState } from "react";
import { api, type Stall } from "../../api";
import { StallForm } from "./StallForm";

const STATUS_TEXT = {
  PENDING: "Pendiente de aprobación por la administración del mercado.",
  APPROVED: "Aprobado: tus productos son visibles para los clientes.",
  REJECTED: "Rechazado.",
};

export function MerchantDashboard() {
  const [stall, setStall] = useState<Stall | null | undefined>(undefined);

  useEffect(() => {
    api<Stall>("/stalls/me")
      .then(setStall)
      .catch(() => setStall(null));
  }, []);

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
    </>
  );
}
