# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# next.erastcg.com runs against the staging backend (src/environments/environment.staging.ts).
RUN npm run build -- --configuration staging

# Stage 2: Serve static files
FROM nginx:alpine

COPY nginx.next.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/eras-web/browser /usr/share/nginx/html

EXPOSE 80
