# ⚒ Build the builder image
FROM node:17.6-alpine as builder

# 🤫 Silence npm
ENV NPM_CONFIG_LOGLEVEL=error

# 👇 Add Tini
RUN apk add --no-cache tini git
# Tini is now available at /sbin/tini
ENTRYPOINT ["/sbin/tini", "--"]

# Init submodules
# RUN git submodule update --init

# 👇 Create working directory and assign ownership
WORKDIR /app

# 👇 Copy config files and source
COPY package*.json tsconfig.json ./
COPY src ./src

# 👇 Install deps and build source
RUN npm config set unsafe-perm true
RUN npm ci
RUN npm run build

FROM builder as prodbuild
# 👇 Delete dev deps as they are no longer needed
RUN npm prune --production

# 🚀 Build the runner image
FROM node:17.6-alpine as runner

# 👇 Add Tini again
RUN apk add --no-cache tini bash
# Tini is now available at /sbin/tini
ENTRYPOINT ["/sbin/tini", "--"]

# 👇 Create working directory and assign ownership
WORKDIR /app

# 👇 Copy the built app from the prodbuild image
COPY --from=prodbuild /app ./

RUN mkdir /brokerdata
VOLUME /brokerdata

# Expose broker and web-ui port
EXPOSE 16677
EXPOSE 16688

# Set production environment
ENV NODE_ENV=production

# ⚙️ Configure the default command
#CMD ["/bin/bash"]
CMD ["node", "build/src/index.js"]
