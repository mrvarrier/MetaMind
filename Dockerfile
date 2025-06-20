# Multi-stage Docker build for MetaMind
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY tailwind.config.js ./
COPY postcss.config.js ./

# Build frontend
RUN npm run build

# Rust build stage
FROM rust:1.70-alpine AS rust-builder

RUN apk add --no-cache \
    musl-dev \
    pkgconfig \
    openssl-dev \
    sqlite-dev \
    build-base

WORKDIR /app

# Copy Rust manifests
COPY src-tauri/Cargo.toml src-tauri/Cargo.lock ./src-tauri/

# Create a dummy main.rs to cache dependencies
RUN mkdir -p src-tauri/src && echo "fn main() {}" > src-tauri/src/main.rs

# Build dependencies
WORKDIR /app/src-tauri
RUN cargo build --release

# Copy actual source code
COPY src-tauri/src/ ./src/
COPY src-tauri/tauri.conf.json ./

# Build the actual application
RUN cargo build --release

# Final runtime stage
FROM alpine:latest

RUN apk add --no-cache \
    ca-certificates \
    sqlite

# Create app user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Copy built binaries
COPY --from=rust-builder /app/src-tauri/target/release/metamind ./bin/
COPY --from=frontend-builder /app/dist ./web/

# Create necessary directories
RUN mkdir -p /app/data /app/logs && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ./bin/metamind --health-check || exit 1

CMD ["./bin/metamind", "--serve", "--port", "8080", "--data-dir", "/app/data"]