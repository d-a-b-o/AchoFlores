import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App";
import { mockApi, renderWithProviders } from "./utils";

const customer = { id: "c", email: "c@x.pe", name: "Ana", role: "CUSTOMER" };
const checkout = {
  id: "ck_12345678", status: "PAID", fulfillment: "DELIVERY", district: "Miraflores", deliveryFeeCents: 1200, itemsTotalCents: 3000, totalCents: 4200,
  orders: [{ id: "o1", status: "PAID", subtotalCents: 3000, items: [{ id: "i", name: "Rosa", unitPriceCents: 300, quantity: 10 }], stall: { name: "Flores Rosa", number: "B-12" } }],
};

beforeEach(() => {
  localStorage.setItem("achoflores.cart", JSON.stringify([{ productId: "p1", quantity: 10 }]));
  sessionStorage.setItem("achoflores.token", "t");
});

describe("Checkout con delivery o recojo (HU-14)", () => {
  it("envía distrito, dirección y celular, y redirige a la pasarela", async () => {
    const fetchMock = mockApi((url, init) => {
      if (url.endsWith("/auth/me")) return { body: customer };
      if (url.endsWith("/checkout/districts")) return { body: [{ district: "Miraflores", feeCents: 1200 }] };
      if (url.endsWith("/api/checkout") && init?.method === "POST") return { status: 201, body: { id: "ck_1", paymentUrl: "/pasarela/ck_1" } };
      if (url.endsWith("/checkout/ck_1")) return { body: { ...checkout, id: "ck_1", status: "PENDING_PAYMENT" } };
    });
    renderWithProviders(<App />, "/checkout");
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole("combobox", { name: /^Distrito/ }), "Miraflores");
    expect(screen.getByText(/Delivery: S\/\s?12[.,]00/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Dirección"), "Av. Larco 123");
    await user.type(screen.getByLabelText("Celular de contacto"), "987654321");
    await user.click(screen.getByRole("button", { name: "Ir a pagar" }));

    expect(await screen.findByText(/modo sandbox/)).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith("/api/checkout") && i?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ fulfillment: "DELIVERY", district: "Miraflores", address: "Av. Larco 123", phone: "987654321" });
  });

  it("con recojo en puesto no pide distrito ni dirección", async () => {
    const fetchMock = mockApi((url, init) => {
      if (url.endsWith("/auth/me")) return { body: customer };
      if (url.endsWith("/checkout/districts")) return { body: [] };
      if (url.endsWith("/api/checkout") && init?.method === "POST") return { status: 400, body: { error: "Revisa tu carrito", code: "CART_CHANGED" } };
    });
    renderWithProviders(<App />, "/checkout");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: /Recojo en el puesto/ }));
    expect(screen.queryByLabelText("Dirección")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Celular de contacto"), "987654321");
    await user.click(screen.getByRole("button", { name: "Ir a pagar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Revisa tu carrito");
    const post = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith("/api/checkout") && i?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body)).district).toBeUndefined();
  });

  it("pide iniciar sesión antes de comprar", async () => {
    sessionStorage.clear();
    mockApi(() => ({ body: [] }));
    renderWithProviders(<App />, "/checkout");
    expect(screen.getByRole("heading", { name: "Ingresa para comprar" })).toBeInTheDocument();
  });
});

describe("Pago en la pasarela sandbox (HU-12)", () => {
  it("al aprobar el pago muestra la confirmación y vacía el carrito", async () => {
    let paid = false;
    mockApi((url, init) => {
      if (url.endsWith("/auth/me")) return { body: customer };
      if (url.endsWith("/sandbox-gateway/charges") && init?.method === "POST") {
        paid = true;
        return { body: { status: "paid" } };
      }
      if (url.endsWith("/checkout/ck_12345678")) return { body: paid ? checkout : { ...checkout, status: "PENDING_PAYMENT" } };
    });
    renderWithProviders(<App />, "/pasarela/ck_12345678");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Simular pago aprobado" }));
    expect(await screen.findByRole("heading", { name: "¡Pago confirmado!" })).toBeInTheDocument();
    expect(screen.getByText(/Delivery a Miraflores/)).toBeInTheDocument();
    await waitFor(() => expect(JSON.parse(localStorage.getItem("achoflores.cart")!)).toEqual([]));
  });

  it("si el pago es rechazado permite reintentar y conserva el carrito", async () => {
    mockApi((url, init) => {
      if (url.endsWith("/auth/me")) return { body: customer };
      if (url.endsWith("/sandbox-gateway/charges") && init?.method === "POST") return { body: { status: "payment-failed" } };
      if (url.endsWith("/checkout/ck_12345678")) return { body: { ...checkout, status: "PENDING_PAYMENT", failureReason: "Tarjeta rechazada" } };
    });
    renderWithProviders(<App />, "/pasarela/ck_12345678");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Simular pago rechazado" }));
    expect(await screen.findByRole("heading", { name: "Pago pendiente" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reintentar pago" })).toHaveAttribute("href", "/pasarela/ck_12345678");
    expect(JSON.parse(localStorage.getItem("achoflores.cart")!)).toHaveLength(1);
  });
});
