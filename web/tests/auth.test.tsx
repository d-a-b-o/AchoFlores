import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { App } from "../src/App";
import { mockApi, renderWithProviders } from "./utils";

describe("Registro e inicio de sesión (HU-01, HU-02)", () => {
  it("registra un cliente enviando el consentimiento de datos", async () => {
    const fetchMock = mockApi((url) =>
      url.endsWith("/auth/register")
        ? { status: 201, body: { token: "t", user: { id: "1", email: "a@b.pe", name: "Ana", role: "CUSTOMER" } } }
        : undefined,
    );
    renderWithProviders(<App />, "/registro");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Correo"), "a@b.pe");
    await user.type(screen.getByLabelText(/^Contraseña/), "rosas2026");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(screen.getByText(/Salir \(Ana\)/)).toBeInTheDocument());
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ acceptPrivacy: true, accountType: "CUSTOMER" });
    expect(sessionStorage.getItem("achoflores.token")).toBe("t");
  });

  it("muestra el error del servidor cuando el correo ya existe", async () => {
    mockApi(() => ({ status: 409, body: { error: "Este correo ya tiene una cuenta" } }));
    renderWithProviders(<App />, "/registro");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Correo"), "a@b.pe");
    await user.type(screen.getByLabelText(/^Contraseña/), "rosas2026");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Este correo ya tiene una cuenta");
  });

  it("al ingresar como comerciante lo lleva a su puesto", async () => {
    mockApi((url) => {
      if (url.endsWith("/auth/login")) return { body: { token: "t", user: { id: "1", email: "c@b.pe", name: "Rosa", role: "MERCHANT" } } };
    });
    renderWithProviders(<App />, "/ingresar");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Correo"), "c@b.pe");
    await user.type(screen.getByLabelText(/^Contraseña/), "secreto123");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText("Panel del comerciante: próximamente.")).toBeInTheDocument();
  });

  it("muestra el bloqueo de cuenta tras intentos fallidos", async () => {
    mockApi(() => ({ status: 423, body: { error: "Cuenta bloqueada temporalmente. Intenta en 15 minutos.", code: "ACCOUNT_LOCKED" } }));
    renderWithProviders(
      <Routes>
        <Route path="*" element={<App />} />
      </Routes>,
      "/ingresar",
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Correo"), "c@b.pe");
    await user.type(screen.getByLabelText(/^Contraseña/), "mala");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("bloqueada");
  });

  it("protege las rutas de comerciante y administrador", async () => {
    renderWithProviders(<App />, "/admin");
    expect(await screen.findByRole("heading", { name: "Ingresar" })).toBeInTheDocument();
  });
});
