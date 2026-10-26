# Step 1: Base image (Node.js 20 on lightweight Alpine Linux)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy application files
COPY . .

# Use non-root user provided by the official Node image for security
USER node

# Expose port (Cloud Run will inject PORT at runtime)
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
