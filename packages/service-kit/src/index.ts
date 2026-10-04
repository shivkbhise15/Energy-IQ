import compression from "compression";
import cors from "cors";
import express, { type NextFunction, type Request, type Response, type Router } from "express";
import helmet from "helmet";
import { Redis } from "ioredis";
import jwt from "jsonwebtoken";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { PrismaClient } from "@prisma/client";
import {
  ApiError,
  type AuthPrincipal,
  type Permission,
  type Role,
  roleHasPermission,
  toProblemJson
} from "@energyiq/shared";
import type { z } from "zod";

declare global {
  namespace Express {
    interface Request {
      principal?: AuthPrincipal;
    }
  }
}

export const logger = pino({
  name: process.env.SERVICE_NAME ?? "energyiq-service",
  level: process.env.LOG_LEVEL ?? "info"
});

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});

let redisClient: Redis | undefined;

export function redis() {
  redisClient ??= new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2,
    lazyConnect: true
  });
  return redisClient;
}

export function asyncRoute<T extends Request = Request>(
  handler: (request: T, response: Response, next: NextFunction) => Promise<unknown>
) {
  return (request: T, response: Response, next: NextFunction) => {
    handler(request, response, next).catch(next);
  };
}

export function validateBody<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return (request: Request, _response: Response, next: NextFunction) => {
    request.body = schema.parse(request.body);
    next();
  };
}

export function validateQuery<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return (request: Request, _response: Response, next: NextFunction) => {
    request.query = schema.parse(request.query) as Request["query"];
    next();
  };
}

export function requireAuth(request: Request, _response: Response, next: NextFunction) {
  const header = request.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) {
    throw new ApiError(401, "Missing bearer token", "AUTH_REQUIRED");
  }

  try {
    request.principal = jwt.verify(token, process.env.JWT_ACCESS_SECRET ?? "dev-access-secret") as AuthPrincipal;
    next();
  } catch {
    throw new ApiError(401, "Invalid or expired token", "INVALID_TOKEN");
  }
}

export function requireRole(...roles: Role[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const principal = request.principal;
    if (!principal || !roles.includes(principal.role)) {
      throw new ApiError(403, "Insufficient role", "RBAC_DENIED", { roles });
    }
    next();
  };
}

export function requirePermission(permission: Permission) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const principal = request.principal;
    if (!principal || !roleHasPermission(principal.role, permission)) {
      throw new ApiError(403, "Permission denied", "RBAC_DENIED", { permission });
    }
    next();
  };
}

export function scopedOrganizationId(request: Request, requestedOrganizationId?: string | null) {
  const principal = request.principal;
  if (!principal) throw new ApiError(401, "Missing authenticated user", "AUTH_REQUIRED");
  if (principal.role === "SUPER_ADMIN") return requestedOrganizationId ?? undefined;
  if (!principal.organizationId) throw new ApiError(403, "User is not assigned to an organization", "ORG_REQUIRED");
  if (requestedOrganizationId && requestedOrganizationId !== principal.organizationId) {
    throw new ApiError(403, "Cross-organization access denied", "TENANT_SCOPE_DENIED");
  }
  return principal.organizationId;
}

export async function audit(request: Request, action: string, entityType: string, entityId?: string, metadata?: unknown) {
  const principal = request.principal;
  await prisma.auditLog.create({
    data: {
      organizationId: principal?.organizationId ?? undefined,
      actorUserId: principal?.userId ?? undefined,
      action,
      entityType,
      entityId,
      ipAddress: request.ip,
      userAgent: request.header("user-agent"),
      metadata: metadata == null ? {} : metadata
    }
  });
}

export function createServiceApp(serviceName: string, router: Router) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );
  app.use(
    cors({
      origin: process.env.FRONTEND_URL?.split(",") ?? ["http://localhost:5173"],
      credentials: true
    })
  );
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use(
    pinoHttp({
      logger,
      customProps: () => ({ service: serviceName })
    })
  );

  app.get("/health/live", (_request, response) => {
    response.json({ service: serviceName, status: "live", timestamp: new Date().toISOString() });
  });
  app.get(
    "/health/ready",
    asyncRoute(async (_request, response) => {
      await prisma.$queryRaw`SELECT 1`;
      response.json({ service: serviceName, status: "ready", timestamp: new Date().toISOString() });
    })
  );

  app.use(router);
  app.use((_request, _response, next) => next(new ApiError(404, "Route not found", "NOT_FOUND")));
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const problem = toProblemJson(error);
    if (problem.status >= 500) {
      logger.error({ error }, "request failed");
    }
    response.status(problem.status).json(problem);
  });

  return app;
}

export function startService(serviceName: string, port: number, router: Router) {
  const app = createServiceApp(serviceName, router);
  app.listen(port, () => {
    logger.info({ serviceName, port }, "service started");
  });
  return app;
}
