# Pin the official Node 24 multi-platform manifest; update through reviewed builds.
FROM node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --ignore-scripts
COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src
COPY server ./server
ENV VITE_KASA_API_URL=/api/v1/ \
    VITE_KASA_COUNTRY=demo \
    VITE_KASA_CURRENCY=EUR \
    VITE_KASA_DEMO_MODE=true
RUN npm run build:pilot

# Reproducible release gate using the same locked Linux dependencies.
FROM build AS verification
COPY eslint.config.js .prettierignore Dockerfile .dockerignore ./
COPY docs/openapi.yaml ./docs/openapi.yaml
RUN npm run check

FROM node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553 AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=verification --chown=node:node /app/dist ./dist
COPY --from=verification --chown=node:node /app/build-api ./build-api
COPY --chown=node:node docs/openapi.yaml ./docs/openapi.yaml
ENV NODE_ENV=production \
    KASA_API_HOST=0.0.0.0 \
    KASA_API_PORT=8787 \
    KASA_API_DEMO_WRITES=false \
    KASA_API_SERVE_WEB=true \
    KASA_API_COUNTRY=demo \
    KASA_API_ENV_FILE=/app/no-runtime-env-file
USER node
EXPOSE 8787
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.KASA_API_PORT||'8787')+'/api/v1/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "build-api/server/index.js"]
