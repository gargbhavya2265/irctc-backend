FROM node:20-alpine

WORKDIR /app

COPY payment-service/package*.json ./

RUN npm ci

COPY payment-service/prisma ./prisma
COPY payment-service/prisma.config.ts ./
COPY payment-service/src ./src
COPY shared ./shared

RUN npx prisma generate

EXPOSE 4006

CMD ["npm", "start"]