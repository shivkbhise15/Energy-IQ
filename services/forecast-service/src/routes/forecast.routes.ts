import { Queue } from "bullmq";
import { Router } from "express";
import { z } from "zod";
import { ApiError, forecastRequestSchema, getPagination } from "@energyiq/shared";
import {
  asyncRoute,
  audit,
  prisma,
  requireAuth,
  requirePermission,
  scopedOrganizationId,
  validateBody
} from "@energyiq/service-kit";

const router = Router();
router.use(requireAuth);

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const forecastQueue = new Queue("forecast-generation", {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    password: redisUrl.password || undefined
  }
});

const generateForecastSchema = forecastRequestSchema.extend({
  organizationId: z.string().uuid().optional(),
  costPerKwh: z.coerce.number().positive().default(0.14)
});

router.get(
  "/forecasts",
  requirePermission("forecasts:read"),
  asyncRoute(async (request, response) => {
    const pagination = getPagination(request.query);
    const organizationId = scopedOrganizationId(request, request.query.organizationId?.toString());
    const where = {
      ...(organizationId ? { organizationId } : {}),
      ...(request.query.buildingId ? { buildingId: request.query.buildingId.toString() } : {}),
      ...(request.query.deviceId ? { deviceId: request.query.deviceId.toString() } : {}),
      ...(request.query.horizon ? { horizon: request.query.horizon.toString() as never } : {})
    };
    const [items, total] = await Promise.all([
      prisma.forecast.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { targetDate: "desc" },
        include: { building: true, device: true }
      }),
      prisma.forecast.count({ where })
    ]);
    response.json({ items, total, page: pagination.page, pageSize: pagination.pageSize });
  })
);

router.post(
  "/forecasts",
  requirePermission("forecasts:read"),
  validateBody(generateForecastSchema),
  asyncRoute(async (request, response) => {
    let organizationId = scopedOrganizationId(request, request.body.organizationId);
    if (!organizationId && request.body.buildingId) {
      const building = await prisma.building.findUnique({ where: { id: request.body.buildingId } });
      organizationId = building?.organizationId;
    }
    if (!organizationId && request.body.deviceId) {
      const device = await prisma.device.findUnique({ where: { id: request.body.deviceId } });
      organizationId = device?.organizationId;
    }
    if (!organizationId) {
      throw new ApiError(400, "organizationId, buildingId, or deviceId is required", "FORECAST_SCOPE_REQUIRED");
    }
    const readings = await prisma.sensorReading.findMany({
      where: {
        timestamp: { gte: request.body.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), lte: request.body.to ?? new Date() },
        sensor: {
          type: { in: ["ENERGY_CONSUMPTION", "POWER"] },
          device: {
            ...(organizationId ? { organizationId } : {}),
            ...(request.body.buildingId ? { buildingId: request.body.buildingId } : {}),
            ...(request.body.deviceId ? { id: request.body.deviceId } : {})
          }
        }
      },
      orderBy: { timestamp: "asc" },
      take: 20000
    });

    const predictions = await forecastWithAi(request.body.horizon, readings.map((reading: { timestamp: Date; value: number }) => ({
      timestamp: reading.timestamp.toISOString(),
      value: reading.value
    })));

    const created = await prisma.$transaction(
      predictions.map((prediction) =>
        prisma.forecast.create({
          data: {
            organizationId,
            buildingId: request.body.buildingId,
            deviceId: request.body.deviceId,
            horizon: request.body.horizon,
            targetDate: new Date(prediction.timestamp),
            predictedKwh: prediction.value,
            predictedCost: prediction.value * request.body.costPerKwh,
            confidenceLow: prediction.low,
            confidenceHigh: prediction.high,
            modelVersion: prediction.modelVersion
          }
        })
      )
    );

    await forecastQueue.add("forecast-generated", {
      organizationId,
      horizon: request.body.horizon,
      points: created.length
    });
    await audit(request, "forecast.generate", "Forecast", undefined, { count: created.length, horizon: request.body.horizon });
    response.status(201).json({ items: created });
  })
);

async function forecastWithAi(horizon: string, readings: Array<{ timestamp: string; value: number }>) {
  try {
    const result = await fetch(`${process.env.AI_SERVICE_URL ?? "http://localhost:8000"}/forecast`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ horizon, readings })
    });
    if (result.ok) return (await result.json()).predictions as Prediction[];
  } catch {
    // Fall through to deterministic baseline forecast.
  }

  const count = horizon === "NEXT_HOUR" ? 1 : horizon === "NEXT_DAY" ? 24 : horizon === "NEXT_WEEK" ? 7 : 30;
  const intervalMs = horizon === "NEXT_HOUR" || horizon === "NEXT_DAY" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const average = readings.length === 0 ? 500 : readings.reduce((sum, reading) => sum + reading.value, 0) / readings.length;
  return Array.from({ length: count }, (_, index) => {
    const value = Math.round((average * (1 + Math.sin(index / 3) * 0.08)) * 100) / 100;
    return {
      timestamp: new Date(Date.now() + (index + 1) * intervalMs).toISOString(),
      value,
      low: Math.round(value * 0.88 * 100) / 100,
      high: Math.round(value * 1.12 * 100) / 100,
      modelVersion: "energyiq-node-baseline-0.1"
    };
  });
}

type Prediction = {
  timestamp: string;
  value: number;
  low?: number;
  high?: number;
  modelVersion: string;
};

export default router;
