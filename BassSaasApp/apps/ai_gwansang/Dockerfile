FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

ENV PORT=4000
EXPOSE 4000

CMD ["npm", "run", "start"]
