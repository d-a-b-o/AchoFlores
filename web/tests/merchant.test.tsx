import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App";
import { mockApi, renderWithProviders } from "./utils";

const merchant = { id: "1", email: "c@b.pe", name: "Rosa", role: "MERCHANT" };
const stall = { id: "s1", name: "Flores Rosa", number: "B-12", pavilion: "B", schedule: "6-18", documentType: "DNI", documentNumber: "12345678" };

describe("Panel del comerciante (HU-03)", () => {
  it("registra el puesto y muestra el estado pendiente", async () => {
    sessionStorage.setItem("achoflores.token", "t");
    mockApi((url, init) => {
      if (url.endsWith("/auth/me")) return { body: merchant };
      if (url.endsWith("/stalls/me")) return { status: 404, body: {} };
      if (url.endsWith("/stalls") && init?.method === "POST") return { status: 201, body: { ...stall, status: "PENDING" } };
    });
    renderWithProviders(<App />, "/mi-puesto");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Nombre del puesto"), "Flores Rosa");
    await user.type(screen.getByLabelText("N.º de puesto"), "B-12");
    await user.type(screen.getByLabelText("Pabellón"), "B");
    await user.type(screen.getByLabelText("Horario"), "6-18");
    await user.type(screen.getByLabelText("N.º de DNI"), "12345678");
    await user.click(screen.getByRole("button", { name: "Enviar para aprobación" }));
    expect(await screen.findByText(/Pendiente de aprobación/)).toBeInTheDocument();
  });

  it("muestra el motivo cuando el puesto fue rechazado", async () => {
    sessionStorage.setItem("achoflores.token", "t");
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return { body: merchant };
      if (url.endsWith("/stalls/me")) return { body: { ...stall, status: "REJECTED", rejectionReason: "DNI no coincide" } };
    });
    renderWithProviders(<App />, "/mi-puesto");
    expect(await screen.findByText(/DNI no coincide/)).toBeInTheDocument();
  });
});
