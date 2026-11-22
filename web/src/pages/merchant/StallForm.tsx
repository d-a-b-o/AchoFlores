import { useState, type FormEvent } from "react";
import { api, type Stall } from "../../api";
import { Alert, Field } from "../../components/Field";

export function StallForm({ onCreated }: { onCreated: (s: Stall) => void }) {
  const [error, setError] = useState("");
  const [docType, setDocType] = useState<"DNI" | "RUC">("DNI");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setError("");
    try {
      onCreated(await api<Stall>("/stalls", { method: "POST", json: data }));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <h2>Registra tu puesto</h2>
      <Field label="Nombre del puesto" name="name" required placeholder="Flores Doña Rosa" />
      <div className="grid-2">
        <Field label="N.º de puesto" name="number" required placeholder="B-12" />
        <Field label="Pabellón" name="pavilion" required placeholder="B" />
      </div>
      <Field label="Horario" name="schedule" required placeholder="Lun-Dom 5:00-17:00" />
      <div className="grid-2">
        <label className="field">
          <span>Documento</span>
          <select name="documentType" value={docType} onChange={(e) => setDocType(e.target.value as "DNI" | "RUC")}>
            <option value="DNI">DNI</option>
            <option value="RUC">RUC</option>
          </select>
        </label>
        <Field
          label={`N.º de ${docType}`}
          name="documentNumber"
          required
          inputMode="numeric"
          pattern={docType === "DNI" ? "\\d{8}" : "\\d{11}"}
        />
      </div>
      <Alert>{error}</Alert>
      <button className="btn">Enviar para aprobación</button>
    </form>
  );
}
