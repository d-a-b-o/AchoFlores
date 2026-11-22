import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App";
import { mockApi, renderWithProviders } from "./utils";

const merchant = { id: "m", email: "m@x.pe", name: "Rosa", role: "MERCHANT" };
const stall = { id: "s1", name: "Flores Rosa", number: "B-12", pavilion: "B", schedule: "6-18", documentType: "DNI", documentNumber: "12345678", status: "APPROVED" };
const order = (status: string, fulfillment = "DELIVERY") => ({
  id: "ord_abcdef", status, subtotalCents: 3000, createdAt: "2026-11-22T10:00:00Z",
  items: [{ id: "i", name: "Rosa", unitPriceCents: 300, quantity: 10 }],
  events: [{ id: "e1", status: "PAID", createdAt: "2026-11-22T10:00:00Z" }],
  checkout: { fulfillment, district: "Rímac", address: "Jr. Trujillo 456", phone: "987654321", customer: { name: "Ana" } },
});

describe("Pedidos del comerciante (HU-15)", () => {
  it("lista pedidos con contacto y avanza el estado", async () => {
    sessionStorage.setItem("achoflores.token", "t");
    const fetchMock = mockApi((url, init) => {
      if (url.endsWith("/auth/me")) return { body: merchant };
      if (url.endsWith("/stalls/me")) return { body: stall };
      if (url.endsWith("/products/mine")) return { body: [] };
      if (url.endsWith("/merchant/orders")) return { body: [order("PAID")] };
      if (url.endsWith("/status") && init?.method === "PATCH") return { body: order("PREPARING") };
    });
    renderWithProviders(<App />, "/mi-puesto");
    const card = (await screen.findByText("Pedido ABCDEF")).closest("li")!;
    expect(within(card).getByText(/987654321/)).toBeInTheDocument();
    expect(within(card).getByText(/Delivery a Rímac/)).toBeInTheDocument();
    await userEvent.setup().click(within(card).getByRole("button", { name: "Preparar" }));
    expect(await within(card).findByText("En preparación")).toBeInTheDocument();
    const patch = fetchMock.mock.calls.find(([, i]) => i?.method === "PATCH");
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ status: "PREPARING" });
  });

  it("ofrece el siguiente paso según la modalidad", async () => {
    sessionStorage.setItem("achoflores.token", "t");
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return { body: merchant };
      if (url.endsWith("/stalls/me")) return { body: stall };
      if (url.endsWith("/products/mine")) return { body: [] };
      if (url.endsWith("/merchant/orders")) return { body: [order("READY", "PICKUP")] };
    });
    renderWithProviders(<App />, "/mi-puesto");
    expect(await screen.findByRole("button", { name: "Entregado al cliente" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar" })).not.toBeInTheDocument();
  });
});
