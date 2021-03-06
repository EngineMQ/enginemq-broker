FROM node:17-alpine as builder
RUN apk add --no-cache tini git python3 build-base make
ENTRYPOINT ["/sbin/tini", "--"]

WORKDIR /app
COPY package*.json tsconfig.json ./
COPY src ./src

# Init submodules
RUN rm -rf ./src/common
RUN git -C ./src clone https://github.com/EngineMQ/common.git

ENV NPM_CONFIG_LOGLEVEL=error
RUN npm config set unsafe-perm true && npm config set fund false
RUN npm ci
RUN npm run build && rm -rf src && npm prune --production





FROM node:17-alpine as runner
RUN apk add --no-cache tini bash sqlite
ENTRYPOINT ["/sbin/tini", "--"]

WORKDIR /app
COPY --from=builder /app ./

RUN mkdir /brokerdata
VOLUME /brokerdata

# Expose broker and web-ui port
EXPOSE 16677 16688

# Set production environment
ENV NODE_ENV=production

ENV STORAGE=sqlite3(file=/brokerdata/enginemq-broker.sqlite3)
ENV LOG_LEVEL=warn
ENV BROKER_PORT=16677
ENV HEARTBEAT_SEC=0
ENV MAX_CLIENT_WORKERS=4
ENV MAX_PACKET_SIZE_KB=16384

ENV HTTP_PORT=16688
ENV API_ENABLED=1
ENV WEBUI_ENABLED=1

#CMD ["/bin/bash"]
CMD ["node", "build/src/index.js"]
