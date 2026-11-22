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
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { "Content-Type": "application/json" } });
  });
}
