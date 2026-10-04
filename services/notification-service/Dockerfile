FROM node:20-alpine AS build

WORKDIR /repo
COPY package*.json tsconfig.base.json ./
COPY packages ./packages
COPY services/notification-service ./services/notification-service
RUN npm install
RUN npm --workspace @energyiq/shared run build \
  && npm --workspace @energyiq/service-kit run build \
  && npm --workspace @energyiq/database run generate \
  && npm --workspace @energyiq/notification-service run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/services/notification-service/dist ./services/notification-service/dist
EXPOSE 4106
CMD ["node", "services/notification-service/dist/index.js"]
