import { useRef, useState, type FormEvent } from "react";
import { api, type Product } from "../../api";
import { Alert, Field } from "../../components/Field";
import { CATEGORY_LABELS, OCCASION_LABELS } from "../../routes";

const MAX_BYTES = 5 * 1024 * 1024;

export function ProductForm({ onCreated }: { onCreated: (p: Product) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const image = data.get("image") as File | null;
    if (!image || image.size === 0) return setError("Agrega una foto del producto");
    if (image.size > MAX_BYTES) return setError("La imagen supera 5 MB");
    for (const k of ["occasion", "wholesalePrice", "wholesaleMinQty"]) if (!data.get(k)) data.delete(k);
    setBusy(true);
    setError("");
    try {
      onCreated(await api<Product>("/products", { method: "POST", body: data }));
      formRef.current?.reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} className="card" onSubmit={onSubmit} aria-label="Publicar producto">
      <h2>Publicar producto</h2>
      <label className="field">
        <span>Foto</span>
        {/* capture abre la cámara directamente en el celular */}
        <input
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          required
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && file.size > MAX_BYTES) {
              setError("La imagen supera 5 MB");
              e.target.value = "";
            } else setError("");
          }}
        />
        <small>JPG, PNG o WebP, máximo 5 MB.</small>
      </label>
      <Field label="Nombre" name="name" required placeholder="Docena de rosas rojas" />
      <div className="grid-2">
        <label className="field">
          <span>Tipo de flor</span>
          <select name="category" required defaultValue="rosas">
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Ocasión</span>
          <select name="occasion" defaultValue="">
            <option value="">Cualquiera</option>
            {Object.entries(OCCASION_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid-2">
        <Field label="Precio (S/)" name="price" type="number" step="0.10" min="0.10" required inputMode="decimal" />
        <Field label="Stock" name="stock" type="number" min="0" step="1" required inputMode="numeric" />
      </div>
      <details className="wholesale">
        <summary>Precio por mayor (opcional)</summary>
        <div className="grid-2">
          <Field label="Precio por mayor c/u (S/)" name="wholesalePrice" type="number" step="0.10" min="0.10" inputMode="decimal" />
          <Field label="Desde (unidades)" name="wholesaleMinQty" type="number" min="2" step="1" inputMode="numeric" placeholder="12" />
        </div>
      </details>
      <Alert>{error}</Alert>
      <button className="btn" disabled={busy}>
        {busy ? "Publicando…" : "Publicar"}
      </button>
    </form>
  );
}
