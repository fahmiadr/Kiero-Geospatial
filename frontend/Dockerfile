# =============================================================================
# Geo Frontend — Production Dockerfile
#
# Multi-stage build: Vite SPA → Nginx static server
# Pinned nginx version, optimized layer caching.
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build React App
# ---------------------------------------------------------------------------
FROM node:jod-alpine3.23 AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci

COPY . .

# Accept VITE_ build args from docker-compose (sourced from root .env)
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_CLIENT_ID
ARG VITE_GATEWAY_URL
ARG VITE_APP_BASE_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY \
    VITE_CLIENT_ID=$VITE_CLIENT_ID \
    VITE_GATEWAY_URL=$VITE_GATEWAY_URL \
    VITE_APP_BASE_URL=$VITE_APP_BASE_URL

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Build Nginx Brotli Module
# ---------------------------------------------------------------------------
FROM nginx:1.29.8-alpine3.23-slim AS brotli-builder

RUN apk add --no-cache gcc libc-dev make pcre2-dev openssl-dev brotli-dev linux-headers zstd-dev

WORKDIR /usr/src

RUN NGINX_VER=$(nginx -v 2>&1 | cut -d '/' -f 2 | cut -d ' ' -f 1) && \
    wget -q "http://nginx.org/download/nginx-${NGINX_VER}.tar.gz" && \
    tar -xzf nginx-$NGINX_VER.tar.gz && \
    # Fetch ngx_brotli source
    wget -q https://github.com/google/ngx_brotli/archive/refs/heads/master.tar.gz -O brotli-nginx-module.tar.gz && \
    tar -xzf brotli-nginx-module.tar.gz && mv ngx_brotli-master brotli-nginx-module && \
    # Fetch brotli core library (manually fulfilling the submodule requirement)
    wget -q https://github.com/google/brotli/archive/refs/heads/master.tar.gz -O brotli.tar.gz && \
    tar -xzf brotli.tar.gz && rm -rf brotli-nginx-module/deps/brotli && mv brotli-master brotli-nginx-module/deps/brotli && \
    # Fetch zstd-nginx-module source
    wget -q https://github.com/tokers/zstd-nginx-module/archive/refs/heads/master.tar.gz -O zstd-nginx-module.tar.gz && \
    tar -xzf zstd-nginx-module.tar.gz && mv zstd-nginx-module-master zstd-nginx-module && \
    # Build the modules
    cd nginx-${NGINX_VER} && \
    CONFARGS=$(nginx -V 2>&1 | sed -n -e 's/^.*arguments: //p') && \
    eval "./configure $CONFARGS --with-compat --add-dynamic-module=../brotli-nginx-module --add-dynamic-module=../zstd-nginx-module" && \
    make modules && \
    mkdir -p /tmp/modules && \
    cp objs/ngx_http_brotli_filter_module.so /tmp/modules/ && \
    cp objs/ngx_http_brotli_static_module.so /tmp/modules/ && \
    cp objs/ngx_http_zstd_filter_module.so /tmp/modules/ && \
    cp objs/ngx_http_zstd_static_module.so /tmp/modules/

# ---------------------------------------------------------------------------
# Stage 3: Nginx Runtime
# ---------------------------------------------------------------------------
FROM nginx:1.29.8-alpine3.23-slim AS runtime

LABEL maintainer="kiero-teknologi" \
      app.name="geo-frontend" \
      app.environment="production"

# Install brotli and zstd runtime dependencies
RUN apk upgrade --no-cache && apk add --no-cache brotli-libs zstd-libs

# Copy the compiled modules
COPY --from=brotli-builder /tmp/modules/*.so /etc/nginx/modules/

# Load the modules at the very top of the main Nginx configuration
RUN sed -i '1s/^/load_module modules\/ngx_http_brotli_filter_module.so;\nload_module modules\/ngx_http_brotli_static_module.so;\nload_module modules\/ngx_http_zstd_filter_module.so;\nload_module modules\/ngx_http_zstd_static_module.so;\n/' /etc/nginx/nginx.conf

# Remove default config and html
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

# Set proper ownership
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]