FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY public ./public
COPY server ./server
COPY scripts ./scripts

ENV PORT=8787
EXPOSE 8787

CMD ["node", "server/index.js"]
