import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App";
import { mockApi, renderWithProviders } from "./utils";

describe("Recuperar contraseña (HU-21)", () => {
  it("solicita el enlace y muestra el mensaje genérico", async () => {
    mockApi(() => ({ status: 202, body: { message: "Si el correo está registrado, te enviamos un enlace" } }));
    renderWithProviders(<App />, "/recuperar");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Correo"), "a@b.pe");
    await user.click(screen.getByRole("button", { name: "Enviar enlace" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Si el correo está registrado");
  });

  it("restablece la contraseña con el token del enlace", async () => {
    const fetchMock = mockApi(() => ({ body: { message: "Contraseña actualizada. Ya puedes ingresar." } }));
    renderWithProviders(<App />, "/restablecer?token=abc123");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Nueva contraseña/), "nueva2026");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(await screen.findByText(/Contraseña actualizada/)).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ token: "abc123", password: "nueva2026" });
  });

  it("muestra el error de enlace vencido", async () => {
    mockApi(() => ({ status: 400, body: { error: "El enlace no es válido o ya venció." } }));
    renderWithProviders(<App />, "/restablecer?token=viejo");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Nueva contraseña/), "nueva2026");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("venció");
  });

  it("enlaza la recuperación desde el ingreso", () => {
    renderWithProviders(<App />, "/ingresar");
    expect(screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" })).toHaveAttribute("href", "/recuperar");
  });
});
