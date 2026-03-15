# =============================================================================
# API Dockerfile - Multi-stage build
# =============================================================================

# Base stage
FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

# Dependencies stage
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --ignore-scripts && \
    DATABASE_URL="file:./dummy.db" npx prisma generate

# Development stage
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p data
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# Build stage
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production stage
FROM base AS production
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma/
RUN mkdir -p data
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
