# Kokoro TTS, always-on. See server.js's header comment for why this is a
# separate service from the main webhook/ (Vercel serverless) deployment.
FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

# Not root — same reasoning ml/'s Dockerfile already documents for its own
# HF Space deploy (see main repo CLAUDE.md): avoids permission surprises on
# whatever cache directory the model download writes into.
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "server.js"]
