# syntax=docker/dockerfile:1
# Imagen única: compila la PWA (web/) y la API (api/); la API sirve ambas.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build -w web && npm run build -w api \
 && npm prune --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/api/package.json /app/api/prisma.config.ts ./api/
COPY --from=build --chown=node:node /app/api/prisma ./api/prisma
COPY --from=build --chown=node:node /app/api/dist ./api/dist
COPY --from=build --chown=node:node /app/web/dist ./web/dist
WORKDIR /app/api
# Se ejecuta como usuario sin privilegios.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["npm", "start"]
