export interface PriceableProduct {
  priceCents: number;
  wholesalePriceCents: number | null;
  wholesaleMinQty: number | null;
}

/** HU-07: aplica el precio por mayor cuando la cantidad alcanza el mínimo. */
export function unitPriceCents(p: PriceableProduct, quantity: number): number {
  if (p.wholesalePriceCents != null && p.wholesaleMinQty != null && quantity >= p.wholesaleMinQty) {
    return p.wholesalePriceCents;
  }
  return p.priceCents;
}

export const lineTotalCents = (p: PriceableProduct, quantity: number) => unitPriceCents(p, quantity) * quantity;
