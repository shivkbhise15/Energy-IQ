import { Router } from "express";
import { z } from "zod";
import { ApiError, createBuildingSchema, createOrganizationSchema, getPagination } from "@energyiq/shared";
import {
  asyncRoute,
  audit,
  prisma,
  requireAuth,
  requirePermission,
  requireRole,
  scopedOrganizationId,
  validateBody
} from "@energyiq/service-kit";

const router = Router();
router.use(requireAuth);

const floorSchema = z.object({
  buildingId: z.string().uuid(),
  label: z.string().min(1).max(80),
  level: z.coerce.number().int()
});

const zoneSchema = z.object({
  buildingId: z.string().uuid(),
  floorId: z.string().uuid().optional(),
  name: z.string().min(1).max(120)
});

const roomSchema = z.object({
  buildingId: z.string().uuid(),
  floorId: z.string().uuid().optional(),
  zoneId: z.string().uuid().optional(),
  name: z.string().min(1).max(120)
});

router.get(
  "/organizations",
  requirePermission("organizations:read"),
  asyncRoute(async (request, response) => {
    const pagination = getPagination(request.query);
    const organizationId = scopedOrganizationId(request, request.query.organizationId?.toString());
    const where = organizationId ? { id: organizationId } : {};
    const [items, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: pagination.sortDirection },
        include: { _count: { select: { buildings: true, devices: true, users: true } } }
      }),
      prisma.organization.count({ where })
    ]);
    response.json({ items, total, page: pagination.page, pageSize: pagination.pageSize });
  })
);

router.post(
  "/organizations",
  requireRole("SUPER_ADMIN"),
  validateBody(createOrganizationSchema),
  asyncRoute(async (request, response) => {
    const organization = await prisma.organization.create({ data: request.body });
    await audit(request, "organization.create", "Organization", organization.id, request.body);
    response.status(201).json(organization);
  })
);

router.get(
  "/organizations/:id",
  requirePermission("organizations:read"),
  asyncRoute(async (request, response) => {
    const organizationId = scopedOrganizationId(request, request.params.id?.toString());
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        buildings: { take: 50, orderBy: { name: "asc" } },
        _count: { select: { users: true, devices: true, alerts: true, recommendations: true } }
      }
    });
    if (!organization) throw new ApiError(404, "Organization not found", "ORG_NOT_FOUND");
    response.json(organization);
  })
);

router.get(
  "/buildings",
  requirePermission("buildings:read"),
  asyncRoute(async (request, response) => {
    const pagination = getPagination(request.query);
    const organizationId = scopedOrganizationId(request, request.query.organizationId?.toString());
    const where = organizationId ? { organizationId } : {};
    const [items, total] = await Promise.all([
      prisma.building.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { name: "asc" },
        include: { _count: { select: { floors: true, rooms: true, devices: true, alerts: true } } }
      }),
      prisma.building.count({ where })
    ]);
    response.json({ items, total, page: pagination.page, pageSize: pagination.pageSize });
  })
);

router.post(
  "/buildings",
  requirePermission("buildings:write"),
  validateBody(createBuildingSchema),
  asyncRoute(async (request, response) => {
    scopedOrganizationId(request, request.body.organizationId);
    const building = await prisma.building.create({ data: request.body });
    await audit(request, "building.create", "Building", building.id, request.body);
    response.status(201).json(building);
  })
);

router.get(
  "/buildings/:id/tree",
  requirePermission("buildings:read"),
  asyncRoute(async (request, response) => {
    const building = await prisma.building.findUnique({
      where: { id: request.params.id?.toString() ?? "" },
      include: {
        floors: { orderBy: { level: "asc" }, include: { rooms: { orderBy: { name: "asc" } }, zones: true } },
        zones: { orderBy: { name: "asc" }, include: { rooms: true } },
        rooms: { orderBy: { name: "asc" } },
        devices: { take: 100, orderBy: { name: "asc" }, include: { sensors: true } }
      }
    });
    if (!building) throw new ApiError(404, "Building not found", "BUILDING_NOT_FOUND");
    scopedOrganizationId(request, building.organizationId);
    response.json(building);
  })
);

router.post(
  "/floors",
  requirePermission("buildings:write"),
  validateBody(floorSchema),
  asyncRoute(async (request, response) => {
    const building = await prisma.building.findUnique({ where: { id: request.body.buildingId } });
    if (!building) throw new ApiError(404, "Building not found", "BUILDING_NOT_FOUND");
    scopedOrganizationId(request, building.organizationId);
    const floor = await prisma.floor.create({ data: request.body });
    await audit(request, "floor.create", "Floor", floor.id, request.body);
    response.status(201).json(floor);
  })
);

router.post(
  "/zones",
  requirePermission("buildings:write"),
  validateBody(zoneSchema),
  asyncRoute(async (request, response) => {
    const building = await prisma.building.findUnique({ where: { id: request.body.buildingId } });
    if (!building) throw new ApiError(404, "Building not found", "BUILDING_NOT_FOUND");
    scopedOrganizationId(request, building.organizationId);
    const zone = await prisma.zone.create({ data: request.body });
    await audit(request, "zone.create", "Zone", zone.id, request.body);
    response.status(201).json(zone);
  })
);

router.post(
  "/rooms",
  requirePermission("buildings:write"),
  validateBody(roomSchema),
  asyncRoute(async (request, response) => {
    const building = await prisma.building.findUnique({ where: { id: request.body.buildingId } });
    if (!building) throw new ApiError(404, "Building not found", "BUILDING_NOT_FOUND");
    scopedOrganizationId(request, building.organizationId);
    const room = await prisma.room.create({ data: request.body });
    await audit(request, "room.create", "Room", room.id, request.body);
    response.status(201).json(room);
  })
);

router.get(
  "/audit-logs",
  requirePermission("audit:read"),
  asyncRoute(async (request, response) => {
    const pagination = getPagination(request.query);
    const organizationId = scopedOrganizationId(request, request.query.organizationId?.toString());
    const where = organizationId ? { organizationId } : {};
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { id: true, email: true, name: true, role: true } } }
      }),
      prisma.auditLog.count({ where })
    ]);
    response.json({ items, total, page: pagination.page, pageSize: pagination.pageSize });
  })
);

export default router;
