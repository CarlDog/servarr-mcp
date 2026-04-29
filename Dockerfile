# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
RUN addgroup -S servarr && adduser -S servarr -G servarr
COPY --from=build --chown=servarr:servarr /app/node_modules ./node_modules
COPY --from=build --chown=servarr:servarr /app/dist ./dist
COPY --from=build --chown=servarr:servarr /app/package.json ./package.json
USER servarr
ENTRYPOINT ["node", "dist/index.js"]
