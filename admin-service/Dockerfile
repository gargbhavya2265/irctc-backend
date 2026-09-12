FROM node:20-alpine

WORKDIR /app

COPY admin-service/package*.json ./

RUN npm ci

COPY admin-service/prisma/schema.prisma ./prisma/schema.prisma
COPY admin-service/prisma/migrations ./prisma/migrations
COPY admin-service/prisma.config.ts ./
COPY admin-service/src ./src
COPY shared ./shared

RUN npx prisma generate

EXPOSE 4003

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]