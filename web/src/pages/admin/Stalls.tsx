import { useCallback, useEffect, useState } from "react";
import { api, type Stall } from "../../api";

export function AdminStalls() {
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => api<Stall[]>("/admin/stalls?status=PENDING").then(setStalls), []);
  useEffect(() => {
    load();
  }, [load]);

  async function review(s: Stall, action: "approve" | "reject") {
    let json: unknown = undefined;
    if (action === "reject") {
      const reason = window.prompt(`Motivo del rechazo del puesto ${s.number}:`);
      if (!reason) return;
      json = { reason };
    }
    try {
      await api(`/admin/stalls/${s.id}/${action}`, { method: "POST", json });
      setMsg(`Puesto ${s.number} ${action === "approve" ? "aprobado" : "rechazado"}.`);
      await load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <section>
      <h1>Puestos pendientes de aprobación</h1>
      {msg && <p role="status" className="alert alert-info">{msg}</p>}
      {!stalls.length && <p className="muted">No hay puestos pendientes.</p>}
      <ul className="list">
        {stalls.map((s) => (
          <li key={s.id} className="card">
            <strong>
              {s.name} · Puesto {s.number} (Pabellón {s.pavilion})
            </strong>
            <span className="muted">
              {s.owner?.name} · {s.owner?.email} · {s.documentType} {s.documentNumber}
            </span>
            <div className="row">
              <button className="btn btn-small" onClick={() => review(s, "approve")}>
                Aprobar
              </button>
              <button className="btn btn-small btn-ghost" onClick={() => review(s, "reject")}>
                Rechazar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
