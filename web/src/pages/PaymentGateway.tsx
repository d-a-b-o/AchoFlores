import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api, formatPEN, PAYMENT_LABEL, type Checkout } from "../api";
import { useCart } from "../cart";

/**
 * Pasarela de pago en modo sandbox (simulada). En producción esta pantalla la sirve la
 * pasarela (Culqi / Mercado Pago): AchoFlores nunca ve ni guarda datos de tarjeta.
 */
export function PaymentGateway() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { clear } = useCart();
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Checkout>(`/checkout/${encodeURIComponent(id)}`).then(setCheckout).catch((e) => setError((e as Error).message));
  }, [id]);

  async function pay(outcome: "approve" | "decline") {
    setBusy(true);
    try {
      const r = await api<{ status: string }>("/sandbox-gateway/charges", { method: "POST", json: { checkoutId: id, outcome } });
      if (r.status === "paid") clear();
      navigate(`/compra/${id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p role="alert" className="alert alert-error">{error}</p>;
  if (!checkout) return <p className="muted">Cargando…</p>;

  return (
    <section className="card narrow gateway">
      <p className="badge">Pasarela de pago · modo sandbox</p>
      <h1>
        Pagar {formatPEN(checkout.totalCents / 100)} con {PAYMENT_LABEL[checkout.paymentMethod ?? "CARD"]}
      </h1>
      <p className="muted">
        {checkout.paymentMethod === "YAPE" || checkout.paymentMethod === "PLIN"
          ? "Entorno de pruebas: en producción escanearías el código QR de la pasarela con tu app."
          : "Entorno de pruebas: no ingreses datos reales de tarjeta."}{" "}
        Elige el resultado que quieres simular.
      </p>
      <div className="row">
        <button className="btn" disabled={busy} onClick={() => pay("approve")}>
          Simular pago aprobado
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => pay("decline")}>
          Simular pago rechazado
        </button>
      </div>
    </section>
  );
}
