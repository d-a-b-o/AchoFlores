import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../auth";
import { Alert, Field } from "../components/Field";
import { homeFor } from "../routes";

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const user = await register({
        name: f.get("name"),
        email: f.get("email"),
        password: f.get("password"),
        accountType: f.get("accountType"),
        acceptPrivacy: f.get("acceptPrivacy") === "on",
      });
      navigate(homeFor(user.role));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card narrow">
      <h1>Crear cuenta</h1>
      <form onSubmit={onSubmit}>
        <fieldset className="segmented">
          <legend>Quiero</legend>
          <label>
            <input type="radio" name="accountType" value="CUSTOMER" defaultChecked={params.get("tipo") !== "comerciante"} /> Comprar flores
          </label>
          <label>
            <input type="radio" name="accountType" value="MERCHANT" defaultChecked={params.get("tipo") === "comerciante"} /> Vender (tengo un puesto)
          </label>
        </fieldset>
        <Field label="Nombre" name="name" autoComplete="name" required minLength={2} />
        <Field label="Correo" name="email" type="email" autoComplete="email" required />
        <Field
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="Mínimo 8 caracteres y al menos un número."
        />
        <label className="check">
          <input type="checkbox" name="acceptPrivacy" />
          <span>
            Acepto el tratamiento de mis datos personales según la Ley N.º 29733 para gestionar mis compras y pedidos.
          </span>
        </label>
        <Alert>{error}</Alert>
        <button className="btn" disabled={busy}>
          {busy ? "Creando…" : "Crear cuenta"}
        </button>
      </form>
      <p className="muted">
        ¿Ya tienes cuenta? <Link to="/ingresar">Ingresa</Link>
      </p>
    </section>
  );
}
