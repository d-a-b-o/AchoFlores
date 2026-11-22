import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { App } from "../src/App";
import { mockApi, renderWithProviders } from "./utils";

describe("Página principal", () => {
  it("muestra la propuesta de valor y el acceso para comerciantes", async () => {
    mockApi(() => ({ body: { items: [], page: 1, pages: 1, total: 0, suggestions: [] } }));
    renderWithProviders(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mercado de Acho");
    expect(screen.getByRole("link", { name: "Soy comerciante" })).toHaveAttribute("href", "/registro?tipo=comerciante");
  });

  it("muestra un mensaje para rutas inexistentes", () => {
    renderWithProviders(<App />, "/no-existe");
    expect(screen.getByText("Página no encontrada.")).toBeInTheDocument();
  });
});
