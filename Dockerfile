# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@latest

# Install dependencies needed for build
RUN apk add --no-cache git

# Copy package files (pnpm uses pnpm-lock.yaml)
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies using pnpm (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript using pnpm
RUN pnpm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm globally in production stage
RUN npm install -g pnpm@latest

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml* ./

# Copy patches directory (needed for patch-package)
COPY --from=builder /app/patches ./patches

# Install only production dependencies using pnpm (postinstall will apply patches)
RUN pnpm install --prod --frozen-lockfile

# Expose port 3005
EXPOSE 3005

# Set environment variable to indicate pnpm usage
# La versión se establecerá en runtime si es necesario
ENV PNPM_VERSION=latest

# Start the application
CMD ["node", "dist/app.js"]