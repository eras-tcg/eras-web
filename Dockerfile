# Stage 1: Build
FROM node:22-alpine AS builder

# next | staging | prod. next and staging use the staging backend (environment.staging.ts),
# prod uses environment.prod.ts.
ARG ENVIRONMENT=next

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN if [ "$ENVIRONMENT" = "prod" ]; then config=production; else config=staging; fi \
 && npm run build -- --configuration "$config"

# Stage 2: Serve static files
FROM nginx:alpine

ARG ENVIRONMENT=next
COPY nginx.${ENVIRONMENT}.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/eras-web/browser /usr/share/nginx/html

EXPOSE 80
