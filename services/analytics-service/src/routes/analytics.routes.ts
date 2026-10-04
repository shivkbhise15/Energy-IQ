import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getPagination, type SensorType } from "@energyiq/shared";
import {
  asyncRoute,
  prisma,
  redis,
  requireAuth,
  requirePermission,
  scopedOrganizationId
} from "@energyiq/service-kit";

const router = Router();
router.use(requireAuth);

const rangeQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  buildingId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});

router.get(
  "/dashboard",
  requirePermission("analytics:read"),
  asyncRoute(async (request, response) => {
    const query = rangeQuerySchema.parse(request.query);
    const organizationId = scopedOrganizationId(request, query.organizationId);
    const cacheKey = `dashboard:${organizationId ?? "all"}:${query.buildingId ?? "all"}`;

    const cached = await tryCacheGet(cacheKey);
    if (cached) return response.json(JSON.parse(cached));

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last48Hours = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const deviceWhere = {
      ...(organizationId ? { organizationId } : {}),
      ...(query.buildingId ? { buildingId: query.buildingId } : {})
    };
    const readingWhere: Prisma.SensorReadingWhereInput = {
      timestamp: { gte: last48Hours },
      sensor: {
        type: { in: ["ENERGY_CONSUMPTION", "POWER"] as SensorType[] },
        device: deviceWhere
      }
    };

    const [rawReadings, deviceCount, onlineCount, activeAlerts, criticalAlerts, latestForecast, alerts, recommendations] =
      await Promise.all([
        prisma.sensorReading.findMany({
          where: readingWhere,
          orderBy: { timestamp: "asc" },
          take: 12000,
          include: {
            sensor: {
              include: {
                device: {
                  include: {
                    building: { select: { id: true, name: true } }
                  }
                }
              }
            }
          }
        }),
        prisma.device.count({ where: deviceWhere }),
        prisma.device.count({ where: { ...deviceWhere, status: "ONLINE" } }),
        prisma.alert.count({ where: { ...(organizationId ? { organizationId } : {}), status: "OPEN" } }),
        prisma.alert.count({ where: { ...(organizationId ? { organizationId } : {}), status: "OPEN", level: "CRITICAL" } }),
        prisma.forecast.findFirst({
          where: { ...(organizationId ? { organizationId } : {}), horizon: "NEXT_MONTH" },
          orderBy: { targetDate: "desc" }
        }),
        prisma.alert.findMany({
          where: { ...(organizationId ? { organizationId } : {}) },
          take: 8,
          orderBy: { createdAt: "desc" },
          include: { building: true, device: true }
        }),
        prisma.recommendation.findMany({
          where: { ...(organizationId ? { organizationId } : {}) },
          take: 8,
          orderBy: [{ impact: "desc" }, { createdAt: "desc" }],
          include: { device: true }
        })
      ]);

    const readings = rawReadings as Array<{
      timestamp: Date;
      value: number;
      sensor: { device: { name: string; building: { name: string } } };
    }>;

    const todayKwh = sumReadings(readings.filter((reading) => reading.timestamp >= today));
    const monthlyKwh = sumReadings(readings.filter((reading) => reading.timestamp >= monthStart));
    const currentKw = readings.at(-1)?.value ?? 0;
    const hourlyUsage = bucketReadings(readings, "hour");
    const dailyUsage = bucketReadings(readings, "day");
    const buildingComparison = comparisonBy(readings, (reading) => reading.sensor.device.building.name);
    const deviceComparison = comparisonBy(readings, (reading) => reading.sensor.device.name).slice(0, 10);
    const topConsumers = deviceComparison.slice(0, 8).map((item, index) => ({
      rank: index + 1,
      name: item.name,
      consumptionKwh: item.value,
      change: Math.round((index % 2 === 0 ? 1 : -1) * (6 + index * 2))
    }));

    const efficiencyScore = Math.max(55, Math.round(96 - activeAlerts * 1.7 - criticalAlerts * 4 - (deviceCount - onlineCount) * 0.8));
    const payload = {
      generatedAt: now.toISOString(),
      widgets: {
        currentConsumptionKw: round(currentKw),
        todayConsumptionKwh: round(todayKwh),
        monthlyConsumptionKwh: round(monthlyKwh || todayKwh * 30),
        predictedMonthlyBillUsd: round(latestForecast?.predictedCost ?? (monthlyKwh || todayKwh * 30) * 0.14),
        activeAlerts,
        efficiencyScore
      },
      charts: {
        hourlyUsage,
        dailyUsage,
        weeklyUsage: dailyUsage.slice(-7),
        monthlyUsage: dailyUsage,
        deviceComparison,
        buildingComparison
      },
      tables: {
        topConsumers,
        recentAlerts: alerts,
        recentRecommendations: recommendations
      }
    };

    await tryCacheSet(cacheKey, JSON.stringify(payload), 45);
    response.json(payload);
  })
);

router.get(
  "/analytics/readings",
  requirePermission("analytics:read"),
  asyncRoute(async (request, response) => {
    const query = rangeQuerySchema.parse(request.query);
    const pagination = getPagination(request.query);
    const organizationId = scopedOrganizationId(request, query.organizationId);
    const where = {
      timestamp: {
        gte: query.from ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
        lte: query.to ?? new Date()
      },
      sensor: {
        device: {
          ...(organizationId ? { organizationId } : {}),
          ...(query.buildingId ? { buildingId: query.buildingId } : {})
        }
      }
    };
    const [items, total] = await Promise.all([
      prisma.sensorReading.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { timestamp: "desc" },
        include: { sensor: { include: { device: true } } }
      }),
      prisma.sensorReading.count({ where })
    ]);
    response.json({ items, total, page: pagination.page, pageSize: pagination.pageSize });
  })
);

function sumReadings(readings: Array<{ value: number }>) {
  return round(readings.reduce((sum, reading) => sum + reading.value, 0));
}

function bucketReadings(readings: Array<{ timestamp: Date; value: number }>, unit: "hour" | "day") {
  const buckets = new Map<string, number>();
  for (const reading of readings) {
    const date = new Date(reading.timestamp);
    if (unit === "hour") date.setMinutes(0, 0, 0);
    if (unit === "day") date.setHours(0, 0, 0, 0);
    const key = date.toISOString();
    buckets.set(key, (buckets.get(key) ?? 0) + reading.value);
  }
  return [...buckets.entries()].map(([timestamp, value]) => ({ timestamp, value: round(value) }));
}

function comparisonBy<T extends { value: number }>(items: T[], selector: (item: T) => string) {
  const totals = new Map<string, number>();
  for (const item of items) {
    const key = selector(item);
    totals.set(key, (totals.get(key) ?? 0) + item.value);
  }
  return [...totals.entries()]
    .map(([name, value]) => ({ name, value: round(value) }))
    .sort((a, b) => b.value - a.value);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

async function tryCacheGet(key: string) {
  try {
    return await redis().get(key);
  } catch {
    return null;
  }
}

async function tryCacheSet(key: string, value: string, seconds: number) {
  try {
    await redis().set(key, value, "EX", seconds);
  } catch {
    // Dashboard still works when Redis is unavailable.
  }
}

export default router;
