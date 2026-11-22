import { useState, type FormEvent } from "react";
import { api } from "../api";
import { Alert, Field } from "../components/Field";

export function ForgotPassword() {
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    try {
      const r = await api<{ message: string }>("/auth/forgot-password", { method: "POST", json: { email } });
      setMsg(r.message);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card narrow">
      <h1>Recuperar contraseña</h1>
      <form onSubmit={onSubmit}>
        <Field label="Correo" name="email" type="email" required autoComplete="email" />
        <Alert>{error}</Alert>
        <Alert kind="ok">{msg}</Alert>
        <button className="btn">Enviar enlace</button>
      </form>
    </section>
  );
}
