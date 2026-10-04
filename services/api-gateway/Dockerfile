FROM node:20-alpine AS build

WORKDIR /repo
COPY package*.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/api-gateway ./services/api-gateway
RUN npm install
RUN npm --workspace @energyiq/shared run build && npm --workspace @energyiq/api-gateway run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/services/api-gateway/dist ./services/api-gateway/dist
EXPOSE 8080
CMD ["node", "services/api-gateway/dist/index.js"]
