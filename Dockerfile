FROM node:22-slim

WORKDIR /app

# Install git which npm requires for Baileys crypto / signal dependencies
RUN apt-get update && apt-get install -y git ca-certificates && rm -rf /var/lib/apt/lists/*

# Install dependencies from railway_bot
COPY railway_bot/package*.json ./
RUN npm install --omit=dev

# Copy the bot files into container
COPY railway_bot/ ./

# Persistent storage configuration
ENV DATA_DIR=/data
ENV SESSION_DIR=/data/session

CMD ["node", "index.js"]
