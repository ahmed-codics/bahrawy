# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS dependencies
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
COPY apps/academy-web/package.json apps/academy-web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/e2e/package.json apps/e2e/package.json
COPY apps/staff-admin/package.json apps/staff-admin/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN --mount=type=cache,target=/root/.npm npm ci

FROM dependencies AS source
COPY . .
RUN npm run generate

FROM source AS api-build
RUN npm run build -w @bahrawy/config \
 && npm run build -w @bahrawy/types \
 && npm run build -w @bahrawy/db \
 && npm run build -w api \
 && npm prune --omit=dev

FROM node:24-alpine AS api
WORKDIR /app/apps/api
ENV NODE_ENV=production
ENV PORT=3000
RUN apk add --no-cache libc6-compat openssl \
 && mkdir -p /app/apps/api/.uploads \
 && chown -R node:node /app

COPY --from=api-build --chown=node:node /app/node_modules /app/node_modules
COPY --from=api-build --chown=node:node /app/apps/api/package.json ./package.json
COPY --from=api-build --chown=node:node /app/apps/api/dist ./dist
COPY --from=api-build --chown=node:node /app/packages/config /app/packages/config
COPY --from=api-build --chown=node:node /app/packages/db /app/packages/db
COPY --from=api-build --chown=node:node /app/packages/types /app/packages/types

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM source AS migrate
RUN npm run build -w @bahrawy/config \
 && npm run build -w @bahrawy/db
CMD ["npm", "run", "migrate:deploy"]

FROM source AS academy-build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build -w academy-web

FROM node:24-alpine AS academy-web
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001
COPY --from=academy-build --chown=node:node /app/apps/academy-web/.next/standalone ./
COPY --from=academy-build --chown=node:node /app/apps/academy-web/.next/static ./apps/academy-web/.next/static
COPY --from=academy-build --chown=node:node /app/apps/academy-web/public ./apps/academy-web/public
USER node
EXPOSE 3001
CMD ["node", "apps/academy-web/server.js"]

FROM source AS staff-build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build -w staff-admin

FROM node:24-alpine AS staff-admin
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3002
COPY --from=staff-build --chown=node:node /app/apps/staff-admin/.next/standalone ./
COPY --from=staff-build --chown=node:node /app/apps/staff-admin/.next/static ./apps/staff-admin/.next/static
COPY --from=staff-build --chown=node:node /app/apps/staff-admin/public ./apps/staff-admin/public
USER node
EXPOSE 3002
CMD ["node", "apps/staff-admin/server.js"]
