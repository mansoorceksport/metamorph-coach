# Build Stage - Use Node 24 to match local dev environment
FROM node:24-slim AS builder

WORKDIR /app

# Build arguments for version tracking
ARG APP_VERSION=1.0.0

# Install pnpm and build dependencies
RUN npm install -g pnpm && \
    apt-get update && \
    apt-get install -y python3 make g++ git && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies - skip postinstall scripts (nuxt prepare fails on ARM64)
RUN pnpm install --frozen-lockfile --ignore-scripts || pnpm install --no-frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Set version for Sentry release tracking
ENV APP_VERSION=${APP_VERSION}

# Manually prepare and build (without oxc-parser dependency)
ENV NUXT_ESLINT_ENABLED=false
RUN pnpm build

# Runtime Stage
FROM node:24-slim

WORKDIR /app

# Pass version to runtime
ARG APP_VERSION=1.0.0
ENV APP_VERSION=${APP_VERSION}

# Copy built output only (no node_modules needed at runtime)
COPY --from=builder /app/.output ./.output

# Expose port
EXPOSE 3000

# Environment variables
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

# Run
CMD ["node", ".output/server/index.mjs"]
