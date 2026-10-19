FROM node:22-slim

WORKDIR /app

# Install git which npm requires for Baileys crypto / signal dependencies
RUN apt-get update && apt-get install -y git ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV DATA_DIR=/data
ENV SESSION_DIR=/data/session

CMD ["node", "index.js"]
