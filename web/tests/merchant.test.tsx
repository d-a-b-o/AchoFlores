import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App";
import { mockApi, renderWithProviders } from "./utils";

const merchant = { id: "1", email: "c@b.pe", name: "Rosa", role: "MERCHANT" };
const stall = { id: "s1", name: "Flores Rosa", number: "B-12", pavilion: "B", schedule: "6-18", documentType: "DNI", documentNumber: "12345678" };
const product = { id: "p1", stallId: "s1", name: "Rosas rojas", category: "rosas", price: 35, priceCents: 3500, stock: 10, active: true, imageUrl: "/api/images/x" };

describe("Panel del comerciante (HU-03, HU-05, HU-06)", () => {
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

  it("con puesto aprobado lista productos y permite desactivarlos", async () => {
    sessionStorage.setItem("achoflores.token", "t");
    mockApi((url, init) => {
      if (url.endsWith("/auth/me")) return { body: merchant };
      if (url.endsWith("/stalls/me")) return { body: { ...stall, status: "APPROVED" } };
      if (url.endsWith("/products/mine")) return { body: [product] };
      if (url.endsWith("/products/p1") && init?.method === "PATCH") return { body: { ...product, active: false } };
    });
    renderWithProviders(<App />, "/mi-puesto");
    expect(await screen.findByText("Rosas rojas")).toBeInTheDocument();
    expect(screen.getByText(/35[.,]00/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Activar" })).toBeInTheDocument());
  });

  it("valida en el cliente que la foto no supere 5 MB", async () => {
    sessionStorage.setItem("achoflores.token", "t");
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return { body: merchant };
      if (url.endsWith("/stalls/me")) return { body: { ...stall, status: "APPROVED" } };
      if (url.endsWith("/products/mine")) return { body: [] };
    });
    renderWithProviders(<App />, "/mi-puesto");
    const user = userEvent.setup();
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    await user.upload(await screen.findByLabelText(/^Foto/), big);
    expect(await screen.findByRole("alert")).toHaveTextContent("5 MB");
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
