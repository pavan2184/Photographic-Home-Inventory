FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 8081

CMD ["npx", "expo", "start", "--lan"]
