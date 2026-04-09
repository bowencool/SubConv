FROM node:22-alpine AS builder
LABEL name="subconv"

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY config.yaml /app/config.yaml

EXPOSE 8080

ENV PORT=8080
ENV HOST=0.0.0.0

CMD ["node", "dist/server/index.js"]
