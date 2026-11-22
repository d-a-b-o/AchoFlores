# AchoFlores

Marketplace web multivendedor (PWA) para el **Mercado de Flores de Acho** (Rímac, Lima): cada puesto publica su catálogo y recibe pedidos en línea con pago y delivery en Lima Metropolitana.

| | |
|---|---|
| **Producción** | _se completa al desplegar en Render_ |
| **Staging** | _se completa al desplegar en Render_ |
| **Jira** | Proyecto `ACF` — backlog, sprints y tablero |

## Arquitectura

```
Navegador (PWA React)  ──HTTPS──▶  API REST Express (Node 22, TypeScript)  ──▶  PostgreSQL (Neon)
                                     │  helmet · CORS · rate limit · zod · JWT + RBAC
                                     ├──▶ Cloudinary (fotos de productos)
                                     └──▶ Pasarela de pago sandbox (webhook firmado HMAC)
```

Un solo contenedor Docker sirve la PWA compilada y la API (`/api/*`), así no hay CORS ni cookies entre dominios.

## Estructura

```
api/   API REST (Express 5, Prisma 7, Vitest + Supertest)
web/   PWA (React 19, Vite, Vitest + Testing Library)
.github/workflows/  CI/CD: build → test → seguridad → deploy
Dockerfile          imagen única (web + api), usuario sin privilegios
render.yaml         Blueprint de Render (producción y staging)
```

## Desarrollo local

Requisitos: Node 22 y PostgreSQL 16.

```bash
npm ci
export DATABASE_URL=postgresql://postgres:test@localhost:5432/achoflores_test
npm run db:migrate -w api
export SEED_ADMIN_EMAIL=admin@acho.pe SEED_DEMO=true
read -rs SEED_ADMIN_PASSWORD && export SEED_ADMIN_PASSWORD   # nunca escribas la clave en archivos
npm run db:seed -w api
npm run dev:api   # http://localhost:3000
npm run dev:web   # http://localhost:5173 (proxy /api → 3000)
```

Pruebas: `npm test` (API contra PostgreSQL real + web con jsdom). Lint: `npm run lint`.

## Estrategia de ramas

| Rama | Propósito | Despliega a |
|---|---|---|
| `main` | Producción | Render `achoflores` |
| `develop` | Pruebas / integración | Render `achoflores-staging` + DAST (OWASP ZAP) |
| `feature/ACF-xx-descripcion` | Una historia de usuario de Jira | — (solo CI en el PR) |

Commits con [Conventional Commits](https://www.conventionalcommits.org/es/) y la clave de Jira (`feat(auth): ACF-7 HU-01 registro de cliente`), para que Jira los enlace a la historia.

## Pipeline CI/CD (GitHub Actions)

1. **Build**: `npm ci`, ESLint con `eslint-plugin-security`, chequeo de tipos y compilación.
2. **Test**: Vitest + Supertest contra PostgreSQL 16 en un contenedor de servicio; cobertura mínima 70 % en la API.
3. **Seguridad** (en paralelo): CodeQL (SAST), `npm audit --audit-level=high`, Dependency Review en PRs, Gitleaks (secretos), Trivy (imagen Docker).
4. **Deploy**: solo en push a `develop`/`main` con todo en verde; dispara el deploy hook de Render y espera a que `/health` responda. En `develop` corre además OWASP ZAP baseline (DAST).
