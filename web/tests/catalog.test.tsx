import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App";
import { mockApi, renderWithProviders } from "./utils";

const stall = { id: "s1", name: "Flores Rosa", number: "B-12", pavilion: "B" };
const p = (id: string, name: string, extra = {}) => ({
  id, stallId: "s1", name, category: "rosas", price: 30, priceCents: 3000, stock: 10, active: true, imageUrl: "/x.png", stall, ...extra,
});

describe("Catálogo público (HU-08, HU-09)", () => {
  it("lista productos con su puesto y precio por mayor", async () => {
    mockApi(() => ({ body: { items: [p("1", "Rosas rojas", { wholesalePrice: 25, wholesaleMinQty: 12 })], page: 1, pages: 1, total: 1, suggestions: [] } }));
    renderWithProviders(<App />);
    expect(await screen.findByText("Rosas rojas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Flores Rosa · Puesto B-12/ })).toHaveAttribute("href", "/puestos/s1");
    expect(screen.getByText(/desde 12 u\./)).toBeInTheDocument();
  });

  it("envía los filtros de flor y precio a la API", async () => {
    const fetchMock = mockApi(() => ({ body: { items: [], page: 1, pages: 1, total: 0, suggestions: ["girasoles"] } }));
    renderWithProviders(<App />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Tipo de flor"), "rosas");
    await user.type(screen.getByLabelText("Precio máximo"), "50");
    await user.click(screen.getByRole("button", { name: "Filtrar" }));
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("category=rosas&maxPrice=50"));
    expect(await screen.findByText("No encontramos productos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Girasoles" })).toBeInTheDocument();
  });

  it("pagina los resultados", async () => {
    const fetchMock = mockApi(() => ({ body: { items: [p("1", "Rosas")], page: 1, pages: 2, total: 21, suggestions: [] } }));
    renderWithProviders(<App />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("page=2"));
  });

  it("deshabilita agregar productos agotados", async () => {
    mockApi(() => ({ body: { items: [p("1", "Sin stock", { stock: 0 })], page: 1, pages: 1, total: 1, suggestions: [] } }));
    renderWithProviders(<App />);
    expect(await screen.findByRole("button", { name: /Agregar Sin stock/ })).toBeDisabled();
  });
});

describe("Perfil del puesto (HU-11)", () => {
  it("muestra pabellón, horario y productos", async () => {
    mockApi((url) =>
      url.includes("/catalog/stalls/s1")
        ? { body: { ...stall, schedule: "Lun-Dom 5-17", products: [p("1", "Lirios")] } }
        : undefined,
    );
    renderWithProviders(<App />, "/puestos/s1");
    expect(await screen.findByRole("heading", { name: "Flores Rosa" })).toBeInTheDocument();
    expect(screen.getByText(/Pabellón B/)).toBeInTheDocument();
    expect(screen.getByText(/Lun-Dom 5-17/)).toBeInTheDocument();
    expect(screen.getByText("Lirios")).toBeInTheDocument();
  });

  it("muestra el error si el puesto no existe", async () => {
    mockApi(() => ({ status: 404, body: { error: "Puesto no encontrado" } }));
    renderWithProviders(<App />, "/puestos/zz");
    expect(await screen.findByRole("alert")).toHaveTextContent("Puesto no encontrado");
  });
});
