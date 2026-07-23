# Build context is the platform root (see docker-compose.yml) so the API image
# can bundle the shared content/ directory alongside the server source.
FROM node:20-alpine
WORKDIR /app

# Install dependencies first for better layer caching
COPY server/package.json ./
RUN npm install --omit=dev

# Copy the API source and the shared content directory
COPY server/src ./src
COPY content ./content

ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "start"]
