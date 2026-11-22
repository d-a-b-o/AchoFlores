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
  wholesalePrice?: number | null;
  wholesalePriceCents?: number | null;
  wholesaleMinQty?: number | null;
  stock: number;
  active: boolean;
  imageUrl: string;
}

export interface CatalogProduct extends Product {
  stall: { id: string; name: string; number: string; pavilion: string };
}
export interface CatalogPage {
  items: CatalogProduct[];
  page: number;
  pages: number;
  total: number;
  suggestions: string[];
}
export interface QuoteLine {
  productId: string;
  name: string;
  imageUrl: string;
  quantity: number;
  requested: number;
  unitPriceCents: number;
  wholesaleApplied: boolean;
  lineTotalCents: number;
}
export interface Quote {
  stalls: { stall: { id: string; name: string; number: string }; lines: QuoteLine[]; subtotalCents: number }[];
  totalCents: number;
  warnings: string[];
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

export type OrderStatus = "PENDING_PAYMENT" | "PAID" | "PREPARING" | "READY" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagado",
  PREPARING: "En preparación",
  READY: "Listo",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};
export interface OrderItem {
  id: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}
export interface OrderEvent {
  id: string;
  status: OrderStatus;
  createdAt: string;
}
export interface Checkout {
  id: string;
  status: "PENDING_PAYMENT" | "PAID" | "FAILED";
  fulfillment: "DELIVERY" | "PICKUP";
  district?: string | null;
  address?: string | null;
  deliveryFeeCents: number;
  itemsTotalCents: number;
  totalCents: number;
  paymentMethod?: "CARD" | "YAPE" | "PLIN" | null;
  failureReason?: string | null;
  scheduledFor?: string | null;
  createdAt?: string;
  orders: { id: string; status: OrderStatus; subtotalCents: number; items: OrderItem[]; stall: { name: string; number: string }; events?: OrderEvent[] }[];
}
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}
export interface SalesSummary {
  days: number;
  salesCents: number;
  orders: number;
  topProducts: { name: string; quantity: number; salesCents: number }[];
  byDay: { day: string; salesCents: number }[];
}
export const PAYMENT_LABEL = { CARD: "Tarjeta", YAPE: "Yape", PLIN: "Plin" } as const;
export interface MerchantOrder {
  id: string;
  status: OrderStatus;
  subtotalCents: number;
  createdAt: string;
  items: OrderItem[];
  events: OrderEvent[];
  checkout: { fulfillment: "DELIVERY" | "PICKUP"; district?: string | null; address?: string | null; phone: string; scheduledFor?: string | null; customer: { name: string } };
}
