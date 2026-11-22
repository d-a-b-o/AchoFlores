import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import { AuthProvider } from "../src/auth";
import { CartProvider } from "../src/cart";

export function renderWithProviders(ui: ReactNode, route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <CartProvider>{ui}</CartProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

type Handler = (url: string, init?: RequestInit) => { status?: number; body?: unknown } | undefined;

/** Simula la API: cada handler decide la respuesta según URL y método. */
export function mockApi(handler: Handler) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const r = handler(String(input), init) ?? { status: 404, body: { error: "no mock" } };
    const status = r.status ?? 200;
    // 204 y 304 no pueden llevar cuerpo (la especificación de fetch lo prohíbe).
    const body = status === 204 || status === 304 ? null : JSON.stringify(r.body ?? {});
    return new Response(body, { status, headers: { "Content-Type": "application/json" } });
  });
}
