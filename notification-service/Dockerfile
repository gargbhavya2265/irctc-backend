FROM node:20-alpine

WORKDIR /app

COPY notification-service/package*.json ./

RUN npm ci --omit=dev

COPY notification-service/src ./src

COPY shared ./shared

EXPOSE 4004

CMD ["npm", "start"]