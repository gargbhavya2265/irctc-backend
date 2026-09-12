FROM node:20-alpine

WORKDIR /app

COPY search-service/package*.json ./

RUN npm ci --omit=dev

COPY search-service/src ./src

COPY shared ./shared

EXPOSE 4002

CMD ["npm", "start"]