import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App";
import { mockApi, renderWithProviders } from "./utils";

const customer = { id: "c", email: "c@x.pe", name: "Ana", role: "CUSTOMER" };
const merchant = { id: "m", email: "m@x.pe", name: "Rosa", role: "MERCHANT" };
const stall = { id: "s1", name: "Flores Rosa", number: "B-12", pavilion: "B", schedule: "6-18", documentType: "DNI", documentNumber: "12345678", status: "APPROVED" };
const ev = (status: string) => ({ id: status, status, createdAt: "2026-11-22T10:00:00Z" });

describe("Seguimiento del pedido (HU-17)", () => {
  it("muestra estado, progreso e historial de cada puesto", async () => {
    sessionStorage.setItem("achoflores.token", "t");
    mockApi((url) => {
      if (url.endsWith("/auth/me")) return { body: customer };
      if (url.endsWith("/api/orders"))
        return {
          body: [
            {
              id: "ck_abcdefgh", status: "PAID", fulfillment: "DELIVERY", totalCents: 4200, deliveryFeeCents: 1200, itemsTotalCents: 3000, scheduledFor: "2027-05-09T17:00:00Z",
              orders: [{ id: "o1", status: "PREPARING", subtotalCents: 3000, stall: { name: "Flores Rosa", number: "B-12" }, items: [{ id: "i", name: "Rosa", unitPriceCents: 300, quantity: 10 }], events: [ev("PENDING_PAYMENT"), ev("PAID"), ev("PREPARING")] }],
            },
          ],
        };
    });
    renderWithProviders(<App />, "/mis-pedidos");
    expect(await screen.findByText("Pedido ABCDEFGH")).toBeInTheDocument();
    expect(screen.getByText("Programado para el 2027-05-09")).toBeInTheDocument();
    const bar = screen.getByRole("list", { name: "Progreso del pedido" });
    expect(within(bar).getByText("En preparación")).toHaveClass("done");
    expect(within(bar).getByText("Listo")).not.toHaveClass("done");
  });

  it("indica cuando aún no hay pedidos", async () => {
    sessionStorage.setItem("achoflores.token", "t");
    mockApi((url) => (url.endsWith("/auth/me") ? { body: customer } : { body: [] }));
    renderWithProviders(<App />, "/mis-pedidos");
    expect(await screen.findByRole("heading", { name: "Aún no tienes pedidos" })).toBeInTheDocument();
  });
});

describe("Yape/Plin y pedidos programados en el checkout (HU-16, HU-18)", () => {
  it("envía el medio de pago y la fecha programada", async () => {
    sessionStorage.setItem("achoflores.token", "t");
    localStorage.setItem("achoflores.cart", JSON.stringify([{ productId: "p1", quantity: 12 }]));
    const fetchMock = mockApi((url, init) => {
      if (url.endsWith("/auth/me")) return { body: customer };
      if (url.endsWith("/checkout/districts")) return { body: [] };
      if (url.endsWith("/api/checkout") && init?.method === "POST") return { status: 201, body: { id: "ck_1", paymentUrl: "/pasarela/ck_1" } };
      if (url.endsWith("/checkout/ck_1")) return { body: { id: "ck_1", status: "PENDING_PAYMENT", totalCents: 3600, paymentMethod: "YAPE", orders: [] } };
    });
    renderWithProviders(<App />, "/checkout");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: /Recojo en el puesto/ }));
    await user.type(screen.getByLabelText("Celular de contacto"), "987654321");
    await user.selectOptions(screen.getByLabelText("Medio de pago"), "YAPE");
    const date = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    await user.type(screen.getByLabelText(/^Programar entrega/), date);
    await user.click(screen.getByRole("button", { name: "Ir a pagar" }));
    expect(await screen.findByRole("heading", { name: /con Yape/ })).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith("/api/checkout") && i?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ paymentMethod: "YAPE", scheduledFor: date });
  });
});

describe("Panel del comerciante: avisos y ventas (HU-19, HU-20)", () => {
  function mockMerchant(extra: (url: string, init?: RequestInit) => { status?: number; body?: unknown } | undefined = () => undefined) {
    sessionStorage.setItem("achoflores.token", "t");
    return mockApi((url, init) => {
      const r = extra(url, init);
      if (r) return r;
      if (url.endsWith("/auth/me")) return { body: merchant };
      if (url.endsWith("/stalls/me")) return { body: stall };
      if (url.endsWith("/products/mine")) return { body: [] };
      if (url.includes("/merchant/orders")) return { body: [] };
      if (url.endsWith("/notifications")) return { body: { items: [{ id: "n1", title: "Nuevo pedido ABCDEFGH", body: "10 × Rosa — S/ 30.00", createdAt: "2026-11-22T10:00:00Z" }], unread: 1 } };
      if (url.endsWith("/merchant/dashboard"))
        return {
          body: {
            last7: { days: 7, salesCents: 4500, orders: 2, topProducts: [{ name: "Rosa", quantity: 15, salesCents: 4500 }], byDay: [{ day: "2026-11-21", salesCents: 4500 }] },
            last30: { days: 30, salesCents: 0, orders: 0, topProducts: [], byDay: [] },
          },
        };
    });
  }

  it("muestra el aviso de pedido nuevo y permite marcarlo como leído", async () => {
    const fetchMock = mockMerchant((url, init) => (url.endsWith("/read") && init?.method === "POST" ? { status: 204 } : undefined));
    renderWithProviders(<App />, "/mi-puesto");
    const box = await screen.findByRole("region", { name: "Notificaciones" });
    expect(await within(box).findByText("Nuevo pedido ABCDEFGH")).toBeInTheDocument();
    await userEvent.setup().click(within(box).getByRole("button", { name: "Marcar como leído" }));
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith("/notifications/n1/read") && i?.method === "POST")).toBe(true);
  });

  it("muestra ventas, pedidos y más vendidos, y cambia de periodo", async () => {
    mockMerchant();
    renderWithProviders(<App />, "/mi-puesto");
    const panel = await screen.findByRole("region", { name: "Panel de ventas" });
    expect(await within(panel).findByText(/45[.,]00/, { selector: "strong" })).toBeInTheDocument();
    expect(within(panel).getByText(/Rosa: 15 u\./)).toBeInTheDocument();
    await userEvent.setup().click(within(panel).getByRole("button", { name: "30 días" }));
    expect(within(panel).getByText(/Aún no tienes ventas/)).toBeInTheDocument();
  });

  it("filtra la agenda de pedidos por fecha", async () => {
    const fetchMock = mockMerchant();
    renderWithProviders(<App />, "/mi-puesto");
    const input = await screen.findByLabelText("Agenda del día");
    await userEvent.setup().type(input, "2027-05-09");
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/merchant/orders?date=2027-05-09"))).toBe(true);
  });
});
