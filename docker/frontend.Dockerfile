# =============================================================================
# Frontend Dockerfile - React Application
# =============================================================================
# Stage 1: Build
FROM node:20-alpine AS builder

# Build args para React (se incrustan en el JS en tiempo de build)
ARG REACT_APP_API_HOST
ARG REACT_APP_EVENT_MONITOR_HOST
ENV REACT_APP_API_HOST=${REACT_APP_API_HOST:-localhost}
ENV REACT_APP_EVENT_MONITOR_HOST=${REACT_APP_EVENT_MONITOR_HOST:-localhost}

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Production (nginx)
FROM nginx:1.25-alpine

# Copy built assets
COPY --from=builder /app/build /usr/share/nginx/html

# Variables de entorno para hosts remotos (con fallback a nombres Docker)
ENV LOAD_BALANCER_HOST=load-balancer \
    EVENT_MONITOR_HOST=event-monitor

# Custom nginx config template (envsubst procesado automáticamente por nginx entrypoint)
RUN mkdir -p /etc/nginx/templates && \
    echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /api/ { \
        proxy_pass http://${LOAD_BALANCER_HOST}:8000/; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
    } \
    location /ws/ { \
        proxy_pass http://${EVENT_MONITOR_HOST}:8082/ws/; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
    } \
}' > /etc/nginx/templates/default.conf.template

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
