FROM node:24.19.0-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS base
# Explicit security patch versions; never ignore a fixable runtime finding.
RUN apk add --no-cache --update-cache libcrypto3=3.5.9-r0 libssl3=3.5.9-r0

FROM base AS dependencies
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
# User npm config is a transient BuildKit mount, never an ARG or copied layer.
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=true --mount=type=secret,id=npm_token,env=NODE_AUTH_TOKEN npm ci --ignore-scripts --no-audit --no-fund

FROM dependencies AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN mkdir -p public && API_INTERNAL_URL=http://127.0.0.1:9 PUBLIC_ORIGIN=https://medical.example.test npm run build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
ARG REVISION
ARG API_CLIENT_VERSION
LABEL org.opencontainers.image.revision=$REVISION \
      org.opencontainers.image.source="https://github.com/dadzhioski/professional-services-medical-web" \
      io.professional-services.api-client.version=$API_CLIENT_VERSION
RUN rm -rf /usr/local/lib/node_modules/npm /opt/yarn* /root/.npm
COPY --from=builder --chown=10001:10001 /app/.next/standalone ./
COPY --from=builder --chown=10001:10001 /app/.next/static ./.next/static
COPY --from=builder --chown=10001:10001 /app/public ./public
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(async r=>{if(!r.ok||(await r.json()).status!=='ok')process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
