# AchoFlores

Marketplace web multivendedor (PWA) para el **Mercado de Flores de Acho** (Rímac, Lima): cada puesto publica su catálogo y recibe pedidos en línea con pago y delivery en Lima Metropolitana.

| | |
|---|---|
| **Producción** | https://achoflores.onrender.com |
| **Staging** | https://achoflores-staging.onrender.com |
| **Jira** | Proyecto `ACF` — backlog, sprints y tablero |
| **Informe final** | [docs/INFORME-FINAL.md](docs/INFORME-FINAL.md) |

## Funcionalidades (v1.0.0)

- **Comerciante:** registra su puesto, publica productos con foto desde el celular (precio unitario y por mayor), gestiona pedidos y su agenda de pedidos programados, recibe avisos y ve su panel de ventas.
- **Cliente:** catálogo público con búsqueda y filtros, perfil de cada puesto, carrito multivendedor, delivery por zonas o recojo, pago con tarjeta / Yape / Plin (pasarela sandbox), pedidos programados, seguimiento y constancia por correo.
- **Administración:** aprobación o rechazo de puestos.

Cuenta demo de comerciante (con `SEED_DEMO=true`): `demo.comerciante@achoflores.pe` / `demo-acho-2026`.

## Arquitectura

```
Navegador (PWA React)  ──HTTPS──▶  API REST Express (Node 22, TypeScript)  ──▶  PostgreSQL (Neon)
                                     │  helmet · CORS · rate limit · zod · JWT + RBAC
                                     ├──▶ Cloudinary (fotos de productos)
                                     ├──▶ Resend (correos transaccionales)
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

Pruebas: `npm test` (104 pruebas de API contra PostgreSQL real + 39 de web con jsdom). Lint: `npm run lint`.

### Variables de entorno (producción)

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Cadena de conexión de PostgreSQL (Neon) |
| `JWT_SECRET` | Firma de tokens (mín. 32 caracteres; Render la genera) |
| `PAYMENT_WEBHOOK_SECRET` | Firma HMAC del webhook de pagos (Render la genera) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Cuenta administradora inicial |
| `SEED_DEMO` | `true` crea un puesto de demostración |
| `CLOUDINARY_URL` | Opcional: fotos en Cloudinary (si no, se guardan en PostgreSQL) |
| `RESEND_API_KEY` / `MAIL_FROM` | Opcional: correos reales (si no, se registran en los logs) |
| `PUBLIC_URL` | URL pública usada en los enlaces de los correos |

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
4. **Deploy**: solo en push a `develop`/`main` con todo en verde; dispara el deploy hook de Render, espera a que `/health` informe el commit recién desplegado y corre `scripts/smoke.sh` (en staging, una compra completa; en producción, solo lectura). En `develop` corre además OWASP ZAP baseline (DAST).

> En el plan gratuito de Render el servicio se suspende tras 15 min sin tráfico: la primera visita tarda unos 50 s.
