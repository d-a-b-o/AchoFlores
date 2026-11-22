/**
 * HU-14: delivery por zonas con tarifa fija desde el Mercado de Acho (Rímac).
 * Los distritos fuera de la lista no tienen cobertura: solo recojo en el puesto.
 */
export const DELIVERY_ZONES: Record<string, { zone: 1 | 2 | 3; feeCents: number }> = {};

const ZONES: [1 | 2 | 3, number, string[]][] = [
  [1, 800, ["Rímac", "Cercado de Lima", "Breña", "La Victoria", "San Martín de Porres", "Independencia"]],
  [2, 1200, ["Lince", "Jesús María", "Pueblo Libre", "Magdalena del Mar", "San Miguel", "San Isidro", "Miraflores", "Surquillo", "Los Olivos", "San Luis"]],
  [3, 1800, ["Santiago de Surco", "San Borja", "Barranco", "Chorrillos", "La Molina", "San Juan de Lurigancho", "Ate", "Comas"]],
];
for (const [zone, feeCents, districts] of ZONES) for (const d of districts) DELIVERY_ZONES[d] = { zone, feeCents };

export const DISTRICTS = Object.keys(DELIVERY_ZONES);

export const deliveryFeeFor = (district: string): number | null => DELIVERY_ZONES[district]?.feeCents ?? null;
