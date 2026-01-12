# Sử dụng Alpine Linux - image Node.js siêu nhẹ
FROM node:20-alpine AS base

# Cài đặt dependencies cần thiết cho Alpine
RUN apk add --no-cache \
    tini \
    dumb-init

# Tạo thư mục app
WORKDIR /app

# Copy package files
COPY package*.json ./

# ================================
# DEVELOPMENT STAGE
# ================================
FROM base AS development

# Set timezone to Asia/Ho_Chi_Minh (GMT+7)
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime && \
    echo "Asia/Ho_Chi_Minh" > /etc/timezone

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Run with nodemon for hot reload
CMD ["npm", "run", "dev"]

# ================================
# PRODUCTION BUILDER STAGE
# ================================
FROM base AS builder

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# ================================
# PRODUCTION STAGE
# ================================
FROM node:20-alpine AS production

# Install tini for proper signal handling and set timezone
RUN apk add --no-cache tini tzdata && \
    cp /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime && \
    echo "Asia/Ho_Chi_Minh" > /etc/timezone

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy production dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy source code
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use tini as entrypoint
ENTRYPOINT ["/sbin/tini", "--"]

# Start app
CMD ["node", "src/main.js"]
