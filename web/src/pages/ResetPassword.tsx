import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { api } from "../api";
import { Alert, Field } from "../components/Field";

export function ResetPassword() {
  const [params] = useSearchParams();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    try {
      const r = await api<{ message: string }>("/auth/reset-password", { method: "POST", json: { token: params.get("token"), password } });
      setMsg(r.message);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card narrow">
      <h1>Nueva contraseña</h1>
      {msg ? (
        <>
          <Alert kind="ok">{msg}</Alert>
          <Link to="/ingresar" className="btn">
            Ingresar
          </Link>
        </>
      ) : (
        <form onSubmit={onSubmit}>
          <Field label="Nueva contraseña" name="password" type="password" required minLength={8} autoComplete="new-password" hint="Mínimo 8 caracteres y al menos un número." />
          <Alert>{error}</Alert>
          <button className="btn">Guardar contraseña</button>
        </form>
      )}
    </section>
  );
}
