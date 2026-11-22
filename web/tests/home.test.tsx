import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { App } from "../src/App";

describe("Página principal", () => {
  it("muestra la propuesta de valor y los accesos para clientes y comerciantes", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mercado de Acho");
    expect(screen.getByRole("link", { name: "Soy comerciante" })).toHaveAttribute("href", "/registro?tipo=comerciante");
  });

  it("muestra un mensaje para rutas inexistentes", () => {
    render(
      <MemoryRouter initialEntries={["/no-existe"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("Página no encontrada.")).toBeInTheDocument();
  });
});
