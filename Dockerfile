# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for build
RUN apk add --no-cache git

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Install only production dependencies
RUN npm ci --omit=dev

# Expose port 3005
EXPOSE 3005

# Start the application
CMD ["node", "dist/app.js"]