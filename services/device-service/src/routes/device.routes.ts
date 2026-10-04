import { Queue } from "bullmq";
import { Router } from "express";
import { z } from "zod";
import {
  ApiError,
  createDeviceSchema,
  createSensorSchema,
  getPagination,
  ingestReadingsSchema
} from "@energyiq/shared";
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
const sensorQueue = new Queue("sensor-processing", {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    password: redisUrl.password || undefined
  }
});

const alertUpdateSchema = z.object({
  status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"])
});

router.get(
  "/devices",
  requirePermission("devices:read"),
  asyncRoute(async (request, response) => {
    const pagination = getPagination(request.query);
    const organizationId = scopedOrganizationId(request, request.query.organizationId?.toString());
    const where = {
      ...(organizationId ? { organizationId } : {}),
      ...(request.query.buildingId ? { buildingId: request.query.buildingId.toString() } : {}),
      ...(request.query.type ? { type: request.query.type.toString() as never } : {}),
      ...(request.query.status ? { status: request.query.status.toString() as never } : {})
    };

    const [items, total] = await Promise.all([
      prisma.device.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { name: "asc" },
        include: {
          building: { select: { id: true, name: true } },
          room: { select: { id: true, name: true } },
          _count: { select: { sensors: true, alerts: true, recommendations: true } }
        }
      }),
      prisma.device.count({ where })
    ]);
    response.json({ items, total, page: pagination.page, pageSize: pagination.pageSize });
  })
);

router.post(
  "/devices",
  requirePermission("devices:write"),
  validateBody(createDeviceSchema),
  asyncRoute(async (request, response) => {
    scopedOrganizationId(request, request.body.organizationId);
    const device = await prisma.device.create({ data: request.body });
    await audit(request, "device.create", "Device", device.id, request.body);
    response.status(201).json(device);
  })
);

router.get(
  "/devices/:id",
  requirePermission("devices:read"),
  asyncRoute(async (request, response) => {
    const device = await prisma.device.findUnique({
      where: { id: request.params.id?.toString() ?? "" },
      include: {
        building: true,
        room: true,
        sensors: true,
        alerts: { take: 20, orderBy: { createdAt: "desc" } },
        recommendations: { take: 10, orderBy: { createdAt: "desc" } }
      }
    });
    if (!device) throw new ApiError(404, "Device not found", "DEVICE_NOT_FOUND");
    scopedOrganizationId(request, device.organizationId);
    response.json(device);
  })
);

router.patch(
  "/devices/:id/status",
  requirePermission("devices:write"),
  validateBody(z.object({ status: z.enum(["ONLINE", "OFFLINE", "MAINTENANCE", "DECOMMISSIONED"]) })),
  asyncRoute(async (request, response) => {
    const current = await prisma.device.findUnique({ where: { id: request.params.id?.toString() ?? "" } });
    if (!current) throw new ApiError(404, "Device not found", "DEVICE_NOT_FOUND");
    scopedOrganizationId(request, current.organizationId);
    const device = await prisma.device.update({ where: { id: current.id }, data: { status: request.body.status } });
    await audit(request, "device.status.update", "Device", device.id, request.body);
    response.json(device);
  })
);

router.get(
  "/sensors",
  requirePermission("sensors:read"),
  asyncRoute(async (request, response) => {
    const pagination = getPagination(request.query);
    const organizationId = scopedOrganizationId(request, request.query.organizationId?.toString());
    const where = {
      ...(request.query.deviceId ? { deviceId: request.query.deviceId.toString() } : {}),
      ...(organizationId ? { device: { organizationId } } : {})
    };
    const [items, total] = await Promise.all([
      prisma.sensor.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: "desc" },
        include: { device: { select: { id: true, name: true, type: true, buildingId: true } } }
      }),
      prisma.sensor.count({ where })
    ]);
    response.json({ items, total, page: pagination.page, pageSize: pagination.pageSize });
  })
);

router.post(
  "/sensors",
  requirePermission("sensors:write"),
  validateBody(createSensorSchema),
  asyncRoute(async (request, response) => {
    const device = await prisma.device.findUnique({ where: { id: request.body.deviceId } });
    if (!device) throw new ApiError(404, "Device not found", "DEVICE_NOT_FOUND");
    scopedOrganizationId(request, device.organizationId);
    const sensor = await prisma.sensor.create({ data: request.body });
    await audit(request, "sensor.create", "Sensor", sensor.id, request.body);
    response.status(201).json(sensor);
  })
);

router.post(
  "/readings",
  requirePermission("readings:ingest"),
  validateBody(ingestReadingsSchema),
  asyncRoute(async (request, response) => {
    const readings = request.body.readings as Array<{ sensorId: string; timestamp: Date; value: number }>;
    const sensorIds = [...new Set(readings.map((reading) => reading.sensorId))];
    type IngestSensor = {
      id: string;
      deviceId: string;
      type: string;
      unit: string;
      device: { organizationId: string; buildingId: string | null; name: string };
    };
    const sensors = (await prisma.sensor.findMany({
      where: { id: { in: sensorIds } },
      include: { device: true }
    })) as IngestSensor[];
    if (sensors.length !== sensorIds.length) throw new ApiError(400, "One or more sensors do not exist", "INVALID_SENSOR");

    for (const sensor of sensors) scopedOrganizationId(request, sensor.device.organizationId);

    const sensorMap = new Map<string, IngestSensor>(sensors.map((sensor: IngestSensor) => [sensor.id, sensor]));
    await prisma.sensorReading.createMany({
      data: readings.map((reading) => ({
        sensorId: reading.sensorId,
        timestamp: reading.timestamp,
        value: reading.value
      })),
      skipDuplicates: true
    });

    const alertData = readings
      .map((reading) => {
        const sensor = sensorMap.get(reading.sensorId);
        if (!sensor) return null;
        const threshold = thresholdFor(sensor.type);
        if (reading.value <= threshold) return null;
        return {
          organizationId: sensor.device.organizationId,
          buildingId: sensor.device.buildingId,
          deviceId: sensor.deviceId,
          sensorId: sensor.id,
          level: reading.value > threshold * 1.35 ? "CRITICAL" : "WARNING",
          title: `${sensor.device.name} ${sensor.type.toLowerCase()} spike`,
          description: `Reading ${reading.value} ${sensor.unit} exceeded threshold ${threshold} ${sensor.unit}.`,
          anomalyScore: Math.min(0.99, reading.value / (threshold * 1.6)),
          confidenceScore: 0.82
        };
      })
      .filter(Boolean)
      .slice(0, 100);

    if (alertData.length > 0) {
      await prisma.alert.createMany({ data: alertData as never[] });
    }

    await sensorQueue.add("process-readings", {
      count: request.body.readings.length,
      sensorIds,
      receivedAt: new Date().toISOString()
    });
    await audit(request, "readings.ingest", "SensorReading", undefined, { count: request.body.readings.length });
    response.status(202).json({ accepted: request.body.readings.length, generatedAlerts: alertData.length });
  })
);

router.get(
  "/alerts",
  requirePermission("alerts:read"),
  asyncRoute(async (request, response) => {
    const pagination = getPagination(request.query);
    const organizationId = scopedOrganizationId(request, request.query.organizationId?.toString());
    const where = {
      ...(organizationId ? { organizationId } : {}),
      ...(request.query.status ? { status: request.query.status.toString() as never } : {})
    };
    const [items, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: "desc" },
        include: { building: true, device: true, sensor: true }
      }),
      prisma.alert.count({ where })
    ]);
    response.json({ items, total, page: pagination.page, pageSize: pagination.pageSize });
  })
);

router.patch(
  "/alerts/:id",
  requirePermission("alerts:write"),
  validateBody(alertUpdateSchema),
  asyncRoute(async (request, response) => {
    const alert = await prisma.alert.findUnique({ where: { id: request.params.id?.toString() ?? "" } });
    if (!alert) throw new ApiError(404, "Alert not found", "ALERT_NOT_FOUND");
    scopedOrganizationId(request, alert.organizationId);
    const next = await prisma.alert.update({
      where: { id: alert.id },
      data: {
        status: request.body.status,
        acknowledgedAt: request.body.status === "ACKNOWLEDGED" ? new Date() : alert.acknowledgedAt,
        resolvedAt: request.body.status === "RESOLVED" ? new Date() : alert.resolvedAt
      }
    });
    await audit(request, "alert.update", "Alert", next.id, request.body);
    response.json(next);
  })
);

function thresholdFor(type: string) {
  if (type === "ENERGY_CONSUMPTION") return 115;
  if (type === "POWER") return 140;
  if (type === "TEMPERATURE") return 38;
  if (type === "HUMIDITY") return 80;
  if (type === "CURRENT") return 70;
  return 245;
}

export default router;
