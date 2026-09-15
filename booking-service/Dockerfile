FROM node:20-alpine

WORKDIR /app

COPY booking-service/package*.json ./
RUN npm ci

COPY booking-service/prisma ./prisma
COPY booking-service/prisma.config.ts ./
COPY booking-service/src ./src
COPY shared ./shared

RUN npx prisma generate

EXPOSE 4005

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]