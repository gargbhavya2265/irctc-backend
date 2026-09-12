FROM node:20-alpine

WORKDIR /app

COPY inventory-service/package*.json ./

RUN npm ci

COPY inventory-service/prisma ./prisma
COPY inventory-service/prisma.config.ts ./
COPY inventory-service/src ./src
COPY shared ./shared

RUN npx prisma generate

EXPOSE 4007

CMD ["npm", "start"]