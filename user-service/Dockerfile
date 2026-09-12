FROM node:20-alpine

WORKDIR /app

COPY user-service/package*.json ./

RUN npm ci

COPY user-service/prisma ./prisma
COPY user-service/prisma.config.ts ./
COPY user-service/src ./src
COPY shared ./shared

RUN npx prisma generate

EXPOSE 4001

CMD ["npm", "start"]