import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface CartItem {
  productId: string;
  quantity: number;
}
interface CartState {
  items: CartItem[];
  count: number;
  add: (productId: string, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const KEY = "achoflores.cart";
const CartContext = createContext<CartState | null>(null);

// El carrito es una comodidad local del navegador: precios y stock siempre los recalcula el servidor.
function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((i) => typeof i?.productId === "string" && Number.isInteger(i?.quantity)) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* almacenamiento no disponible: el carrito vive solo en memoria */
    }
  }, [items]);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems((cur) =>
      quantity <= 0 ? cur.filter((i) => i.productId !== productId) : cur.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
    );
  }, []);

  const value = useMemo<CartState>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      add: (productId, quantity = 1) =>
        setItems((cur) =>
          cur.some((i) => i.productId === productId)
            ? cur.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + quantity } : i))
            : [...cur, { productId, quantity }],
        ),
      setQuantity,
      remove: (productId) => setItems((cur) => cur.filter((i) => i.productId !== productId)),
      clear: () => setItems([]),
    }),
    [items, setQuantity],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}
