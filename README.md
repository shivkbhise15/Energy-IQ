# EnergyIQ

EnergyIQ is an AI-powered energy intelligence and monitoring platform for factories, hospitals, campuses, malls, warehouses, data centers, and office portfolios.

The repo is a production-shaped monorepo with a React analytics dashboard, TypeScript microservices, Prisma/PostgreSQL persistence, Redis-backed queues and caching, Qdrant vector search, a FastAPI AI service, Docker Compose, and Kubernetes manifests.

## Architecture

```text
apps/frontend                 React, TypeScript, Vite, Tailwind, Recharts
services/api-gateway          REST gateway, rate limiting, Swagger, reverse proxy
services/auth-service         Register, login, refresh, logout, password reset, JWT
services/organization-service Organizations, buildings, floors, zones, rooms, audit logs
services/device-service       Devices, sensors, reading ingestion, alert state
services/analytics-service    Dashboard aggregation, comparisons, top consumers
services/forecast-service     Energy and cost forecast orchestration
services/notification-service In-app and email notification creation
ai-service                    FastAPI anomaly detection, forecasts, recommendations, vector search
packages/shared               Domain contracts, validation schemas, RBAC
packages/service-kit          Express runtime, auth middleware, tenant scope, errors
packages/database             Prisma schema, partitioning notes, seed data
infra/k8s                     Deployments, services, ingress, HPA, config, secrets
```

## Local Run

```bash
cp .env.example .env
docker compose up --build
```

Open:

- Frontend: http://localhost:5173
- API gateway: http://localhost:8081
- Swagger docs: http://localhost:8081/docs
- AI service: http://localhost:8000/health/ready
- Qdrant: http://localhost:6333/dashboard

Seeded demo credentials:

```text
superadmin@energyiq.local
EnergyIQ-Demo-2026!
```

Each seeded organization also gets an admin user with the same password, for example:

```text
northstar.manufacturing@energyiq.local
EnergyIQ-Demo-2026!
```

## Development

Install Node dependencies:

```bash
npm install
npm run db:generate
npm run typecheck
npm run dev
```

Run migrations and seed against a local Postgres:

```bash
npm run db:migrate
npm run db:seed
```

The frontend falls back to realistic demo analytics if the API is not running, so UI work can continue independently.

## API Surface

Primary routes are exposed through `/api` on the gateway:

- `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`
- `/api/organizations`, `/api/buildings`, `/api/floors`, `/api/zones`, `/api/rooms`
- `/api/devices`, `/api/sensors`, `/api/readings`, `/api/alerts`
- `/api/dashboard`, `/api/analytics/readings`
- `/api/forecasts`
- `/api/notifications`
- `/api/ai/anomaly`, `/api/ai/forecast`, `/api/ai/recommendations`, `/api/ai/vector/search`

RBAC permissions are centralized in `packages/shared/src/index.ts`; enforcement and tenant scoping live in `packages/service-kit/src/index.ts`.

## Data Model

The Prisma schema includes:

- Users, refresh tokens, password reset tokens
- Organizations, buildings, floors, zones, rooms
- Devices, sensors, sensor readings
- Alerts, recommendations, forecasts
- Maintenance reports, incidents
- Audit logs, notifications

`packages/database/prisma/partitioning.sql` documents the production partitioning strategy for high-volume `SensorReading` data.

## Kubernetes

Apply manifests in this order after pushing images:

```bash
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/configmap.yaml
kubectl apply -f infra/k8s/secrets.yaml
kubectl apply -f infra/k8s/stateful-infra.yaml
kubectl apply -f infra/k8s/migrations-job.yaml
kubectl apply -f infra/k8s/deployments.yaml
kubectl apply -f infra/k8s/services.yaml
kubectl apply -f infra/k8s/hpa.yaml
kubectl apply -f infra/k8s/ingress.yaml
```

For production, replace `infra/k8s/secrets.yaml` with a sealed secret or cloud secret manager integration and use managed PostgreSQL/Redis where available.
