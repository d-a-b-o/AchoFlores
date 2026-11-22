import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { forbidden, unauthorized } from "../lib/errors";
import type { Role } from "../generated/prisma/enums";

export interface AuthUser {
  id: string;
  role: Role;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export const signToken = (user: AuthUser) =>
  jwt.sign({ sub: user.id, role: user.role }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    algorithm: "HS256",
  });

/** Verifica el JWT (Authorization: Bearer). */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw unauthorized();
  try {
    const payload = jwt.verify(header.slice(7), config.JWT_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    req.user = { id: String(payload.sub), role: payload.role as Role };
  } catch {
    throw unauthorized("Sesión inválida o vencida");
  }
  next();
};

/** RBAC: solo deja pasar a los roles indicados. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
