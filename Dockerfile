FROM node:22-alpine

WORKDIR /app

# Install dependencies from railway_bot
COPY railway_bot/package*.json ./
RUN npm install --omit=dev

# Copy the bot files into container
COPY railway_bot/ ./

# Persistent storage configuration
ENV DATA_DIR=/data
ENV SESSION_DIR=/data/session

CMD ["node", "index.js"]
