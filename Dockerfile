# syntax=docker/dockerfile:1.7
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
# `npm install` not `npm ci`: the lockfile is generated on Windows
# and omits Linux-only optional peers (@emnapi/*, @rollup/rollup-linux-*)
# that `npm ci` insists on. Same fix as the CI workflow.
RUN npm install --prefer-offline --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:26-alpine AS runtime
WORKDIR /app
RUN addgroup -S servarr && adduser -S servarr -G servarr
COPY --from=build --chown=servarr:servarr /app/node_modules ./node_modules
COPY --from=build --chown=servarr:servarr /app/dist ./dist
COPY --from=build --chown=servarr:servarr /app/package.json ./package.json
USER servarr
ENTRYPOINT ["node", "dist/index.js"]
