import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App";
import { mockApi, renderWithProviders } from "./utils";

describe("Administración de puestos (HU-04)", () => {
  it("aprueba y rechaza puestos pendientes", async () => {
    sessionStorage.setItem("achoflores.token", "t");
    let pending = [
      { id: "s1", name: "Flores Rosa", number: "B-12", pavilion: "B", documentType: "DNI", documentNumber: "12345678", owner: { name: "Rosa", email: "r@x.pe" } },
      { id: "s2", name: "Girasoles Juan", number: "C-3", pavilion: "C", documentType: "DNI", documentNumber: "87654321", owner: { name: "Juan", email: "j@x.pe" } },
    ];
    const fetchMock = mockApi((url, init) => {
      if (url.endsWith("/auth/me")) return { body: { id: "a", email: "admin@x.pe", name: "Admin", role: "ADMIN" } };
      if (url.includes("/admin/stalls?")) return { body: pending };
      if (url.endsWith("/approve")) {
        pending = pending.filter((s) => s.id !== "s1");
        return { body: {} };
      }
      if (url.endsWith("/reject") && init?.method === "POST") {
        pending = [];
        return { body: {} };
      }
    });
    renderWithProviders(<App />, "/admin");
    const user = userEvent.setup();
    await screen.findByText(/Flores Rosa/);
    await user.click(screen.getAllByRole("button", { name: "Aprobar" })[0]);
    expect(await screen.findByRole("status")).toHaveTextContent("B-12 aprobado");

    vi.spyOn(window, "prompt").mockReturnValue("Documento no válido");
    await user.click(screen.getByRole("button", { name: "Rechazar" }));
    expect(await screen.findByText("No hay puestos pendientes.")).toBeInTheDocument();
    const rejectCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/reject"));
    expect(JSON.parse(String(rejectCall?.[1]?.body))).toEqual({ reason: "Documento no válido" });
  });
});
