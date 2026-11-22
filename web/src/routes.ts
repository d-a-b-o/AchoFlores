import type { Role } from "./api";

export const homeFor = (role: Role) => (role === "MERCHANT" ? "/mi-puesto" : role === "ADMIN" ? "/admin" : "/");

export const CATEGORY_LABELS: Record<string, string> = {
  rosas: "Rosas",
  girasoles: "Girasoles",
  lirios: "Lirios",
  claveles: "Claveles",
  orquideas: "Orquídeas",
  tulipanes: "Tulipanes",
  arreglos: "Arreglos",
  coronas: "Coronas",
  otros: "Otros",
};

export const OCCASION_LABELS: Record<string, string> = {
  cumpleanos: "Cumpleaños",
  aniversario: "Aniversario",
  "san-valentin": "San Valentín",
  "dia-de-la-madre": "Día de la Madre",
  "todos-los-santos": "Todos los Santos",
  condolencias: "Condolencias",
  eventos: "Eventos",
  otros: "Otros",
};
