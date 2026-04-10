FROM node:22-alpine AS builder
LABEL name="subconv"

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/dist/standalone /app

EXPOSE 48080

ENV PORT=48080
ENV HOST=0.0.0.0

CMD ["node", "server.js"]
