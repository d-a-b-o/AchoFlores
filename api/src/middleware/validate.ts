import type { ZodType } from "zod";

/** Valida y tipa una entrada con zod; lanza ZodError (→ 400) si no cumple. */
export const parse = <T>(schema: ZodType<T>, data: unknown): T => schema.parse(data);
