FROM node:22-alpine

WORKDIR /app

# Install dependencies first for Docker caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy application files
COPY . .

# Set default data directory
ENV DATA_DIR=/data
ENV SESSION_DIR=/data/session

# Run bot
CMD ["node", "index.js"]
