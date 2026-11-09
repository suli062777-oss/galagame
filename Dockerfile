FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
ENV HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data GOD_PROVIDER=template GOD_ALLOW_PAID_CALLS=false
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "server/api.js"]
