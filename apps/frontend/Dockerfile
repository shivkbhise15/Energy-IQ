FROM node:20-alpine AS build

WORKDIR /repo
COPY package*.json tsconfig.base.json ./
COPY apps/frontend/package.json ./apps/frontend/package.json
RUN npm install
COPY apps/frontend ./apps/frontend
RUN npm --workspace @energyiq/frontend run build

FROM nginx:1.27-alpine AS runtime
COPY infra/nginx/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
