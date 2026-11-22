import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App";
import { mockApi, renderWithProviders } from "./utils";

const quote = {
  stalls: [
    { stall: { id: "a", name: "Flores Rosa", number: "B-12" }, subtotalCents: 6000, lines: [{ productId: "p1", name: "Rosa", imageUrl: "/x", quantity: 24, requested: 24, unitPriceCents: 250, wholesaleApplied: true, lineTotalCents: 6000 }] },
    { stall: { id: "b", name: "Lirios Juan", number: "C-3" }, subtotalCents: 3000, lines: [{ productId: "p2", name: "Lirio", imageUrl: "/x", quantity: 2, requested: 5, unitPriceCents: 1500, wholesaleApplied: false, lineTotalCents: 3000 }] },
  ],
  totalCents: 9000,
  warnings: ["«Lirio»: solo hay 2 disponibles"],
};

beforeEach(() => localStorage.clear());

describe("Carrito multivendedor (HU-10)", () => {
  it("agrega desde el catálogo y actualiza el contador", async () => {
    mockApi(() => ({ body: { items: [{ id: "p1", stallId: "a", name: "Rosa", category: "rosas", price: 3, priceCents: 300, stock: 9, active: true, imageUrl: "/x", stall: { id: "a", name: "Flores Rosa", number: "B-12", pavilion: "B" } }], page: 1, pages: 1, total: 1, suggestions: [] } }));
    renderWithProviders(<App />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Agregar Rosa al carrito" }));
    expect(screen.getByRole("link", { name: "Carrito (1)" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("achoflores.cart")!)).toEqual([{ productId: "p1", quantity: 1 }]);
  });

  it("agrupa por puesto, muestra subtotales, total, precio por mayor y avisos de stock", async () => {
    localStorage.setItem("achoflores.cart", JSON.stringify([{ productId: "p1", quantity: 24 }, { productId: "p2", quantity: 5 }]));
    const fetchMock = mockApi((url) => (url.endsWith("/cart/quote") ? { body: quote } : undefined));
    renderWithProviders(<App />, "/carrito");
    expect(await screen.findByRole("heading", { name: "Flores Rosa · Puesto B-12" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lirios Juan · Puesto C-3" })).toBeInTheDocument();
    expect(screen.getByText(/precio por mayor/)).toBeInTheDocument();
    expect(screen.getByText(/solo hay 2/)).toBeInTheDocument();
    expect(screen.getByText(/Total: S\/\s?90[.,]00/)).toBeInTheDocument();
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.items).toHaveLength(2);
  });

  it("permite quitar productos y muestra el carrito vacío", async () => {
    localStorage.setItem("achoflores.cart", JSON.stringify([{ productId: "p1", quantity: 1 }]));
    mockApi(() => ({ body: { ...quote, stalls: [quote.stalls[0]], warnings: [] } }));
    renderWithProviders(<App />, "/carrito");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Quitar Rosa" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Tu carrito está vacío" })).toBeInTheDocument());
  });

  it("ignora datos corruptos en el almacenamiento local", () => {
    localStorage.setItem("achoflores.cart", "{no es json");
    renderWithProviders(<App />, "/carrito");
    expect(screen.getByRole("heading", { name: "Tu carrito está vacío" })).toBeInTheDocument();
  });
});
