FROM node:24-alpine
WORKDIR /app
COPY deploy/cloud-run/gateway.mjs ./
USER node
CMD ["node", "gateway.mjs"]
