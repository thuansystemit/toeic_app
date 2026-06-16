# Frontend (React/Vite) — built from the monorepo root, served by nginx.
# nginx reverse-proxies /api to the backend, so the browser is always
# same-origin and the app works over any host/IP with no baked-in URL.
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
# Frontend has no native deps — skip lifecycle scripts (no bcrypt build needed).
RUN npm ci --ignore-scripts

COPY frontend frontend
# Relative API base → the browser calls /api on whatever host serves the SPA.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace frontend

FROM nginx:alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
