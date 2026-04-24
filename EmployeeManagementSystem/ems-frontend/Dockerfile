# syntax=docker/dockerfile:1

# Stage 1: Build the React/Vite app
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite bakes these into the bundle at build time.
# Render passes env vars as Docker build args automatically.
ARG VITE_API_BASE_URL
ARG VITE_CHATBOT_API_URL
ARG VITE_PARSER_URL
ARG VITE_SESSION_TIMEOUT_MS=900000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_CHATBOT_API_URL=$VITE_CHATBOT_API_URL
ENV VITE_PARSER_URL=$VITE_PARSER_URL
ENV VITE_SESSION_TIMEOUT_MS=$VITE_SESSION_TIMEOUT_MS

RUN npm run build

# Stage 2: Serve the built output with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
