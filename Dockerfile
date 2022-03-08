# ⚒ Build the builder image
FROM node:17-alpine as builder

# 🤫 Silence npm
ENV NPM_CONFIG_LOGLEVEL=error

# 👇 Add Tini
RUN apk add --no-cache tini
# Tini is now available at /sbin/tini
ENTRYPOINT ["/sbin/tini", "--"]

# 👇 Create working directory and assign ownership
WORKDIR /code

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
FROM node:17-alpine as runner

# 👇 Add Tini again
RUN apk add --no-cache tini
# Tini is now available at /sbin/tini
ENTRYPOINT ["/sbin/tini", "--"]

# 👇 Create working directory and assign ownership
WORKDIR /code

# 👇 Copy the built app from the prodbuild image
COPY --from=prodbuild /code ./

# ⚙️ Configure the default command
CMD ["node", "build/server.js"]
