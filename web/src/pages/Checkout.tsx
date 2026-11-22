import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { api, formatPEN } from "../api";
import { useAuth } from "../auth";
import { useCart } from "../cart";
import { Alert, Field } from "../components/Field";

const dateInDays = (n: number) => new Date(Date.now() - 5 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);

interface District {
  district: string;
  feeCents: number;
}

// HU-14: delivery a un distrito con cobertura o recojo en el puesto.
export function Checkout() {
  const { user } = useAuth();
  const { items } = useCart();
  const navigate = useNavigate();
  const [districts, setDistricts] = useState<District[]>([]);
  const [fulfillment, setFulfillment] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [district, setDistrict] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<District[]>("/checkout/districts").then(setDistricts).catch(() => setDistricts([]));
  }, []);

  if (!user) {
    return (
      <section className="card narrow">
        <h1>Ingresa para comprar</h1>
        <p className="muted">Necesitas una cuenta de cliente para pagar tu pedido.</p>
        <Link className="btn" to="/ingresar">
          Ingresar
        </Link>
      </section>
    );
  }
  if (!items.length) return <p className="muted">Tu carrito está vacío.</p>;

  const fee = districts.find((d) => d.district === district)?.feeCents;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const res = await api<{ id: string; paymentUrl: string }>("/checkout", {
        method: "POST",
        json: {
          items,
          fulfillment,
          phone: f.get("phone"),
          paymentMethod: f.get("paymentMethod"),
          ...(f.get("scheduledFor") && { scheduledFor: f.get("scheduledFor") }),
          ...(fulfillment === "DELIVERY" && { district, address: f.get("address") }),
        },
      });
      navigate(res.paymentUrl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card narrow" onSubmit={onSubmit} aria-label="Datos de entrega">
      <h1>Entrega y pago</h1>
      <fieldset className="segmented">
        <legend>¿Cómo recibes tu pedido?</legend>
        <label>
          <input type="radio" name="fulfillment" checked={fulfillment === "DELIVERY"} onChange={() => setFulfillment("DELIVERY")} /> Delivery en Lima
        </label>
        <label>
          <input type="radio" name="fulfillment" checked={fulfillment === "PICKUP"} onChange={() => setFulfillment("PICKUP")} /> Recojo en el puesto (Mercado de Acho)
        </label>
      </fieldset>
      {fulfillment === "DELIVERY" && (
        <>
          <label className="field">
            <span>Distrito</span>
            <select value={district} onChange={(e) => setDistrict(e.target.value)} required>
              <option value="">Elige tu distrito</option>
              {districts.map((d) => (
                <option key={d.district} value={d.district}>
                  {d.district} — {formatPEN(d.feeCents / 100)}
                </option>
              ))}
            </select>
            <small>¿No está tu distrito? Aún no llegamos ahí: elige recojo en el puesto.</small>
          </label>
          <Field label="Dirección" name="address" required minLength={5} placeholder="Av. Larco 123, dpto. 401" autoComplete="street-address" />
          {fee !== undefined && <p className="muted">Delivery: {formatPEN(fee / 100)}</p>}
        </>
      )}
      <Field label="Celular de contacto" name="phone" required pattern="9\d{8}" inputMode="tel" placeholder="987654321" autoComplete="tel" />
      <label className="field">
        <span>Medio de pago</span>
        <select name="paymentMethod" defaultValue="CARD">
          <option value="CARD">Tarjeta de crédito o débito</option>
          <option value="YAPE">Yape</option>
          <option value="PLIN">Plin</option>
        </select>
      </label>
      <Field
        label="Programar entrega (opcional)"
        name="scheduledFor"
        type="date"
        min={dateInDays(1)}
        max={dateInDays(30)}
        hint="Asegura tus flores para el Día de la Madre, San Valentín o Todos los Santos (de 1 a 30 días)."
      />
      <Alert>{error}</Alert>
      <button className="btn" disabled={busy}>
        {busy ? "Creando pedido…" : "Ir a pagar"}
      </button>
    </form>
  );
}
