FROM node:20-alpine AS build

WORKDIR /repo
COPY package*.json tsconfig.base.json ./
COPY packages ./packages
COPY services/forecast-service ./services/forecast-service
RUN npm install
RUN npm --workspace @energyiq/shared run build \
  && npm --workspace @energyiq/service-kit run build \
  && npm --workspace @energyiq/database run generate \
  && npm --workspace @energyiq/forecast-service run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/services/forecast-service/dist ./services/forecast-service/dist
EXPOSE 4105
CMD ["node", "services/forecast-service/dist/index.js"]
