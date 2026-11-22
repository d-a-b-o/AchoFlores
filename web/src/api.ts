export type Role = "CUSTOMER" | "MERCHANT" | "COURIER" | "ADMIN";
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}
export interface Stall {
  id: string;
  name: string;
  number: string;
  pavilion: string;
  schedule: string;
  documentType: "DNI" | "RUC";
  documentNumber: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  owner?: { name: string; email: string };
}
export interface Product {
  id: string;
  stallId: string;
  name: string;
  description?: string | null;
  category: string;
  occasion?: string | null;
  price: number;
  priceCents: number;
  stock: number;
  active: boolean;
  imageUrl: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

const TOKEN_KEY = "achoflores.token";
const BASE = import.meta.env.VITE_API_URL ?? "";

// El token se guarda en sessionStorage: se borra al cerrar la pestaña.
export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (t: string) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers, body });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.details?.[0]?.message;
    throw new ApiError(res.status, detail ?? data?.error ?? "Error de conexión", data?.code);
  }
  return data as T;
}

export const formatPEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

export const imageSrc = (url: string) => (url.startsWith("/api") ? `${BASE}${url}` : url);
