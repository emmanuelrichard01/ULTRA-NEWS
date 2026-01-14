FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Default: development mode (override in production)
CMD ["npm", "run", "dev"]
