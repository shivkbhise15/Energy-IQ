import { Queue } from "bullmq";
import { Router } from "express";
import { z } from "zod";
import { ApiError, getPagination } from "@energyiq/shared";
import {
  asyncRoute,
  audit,
  prisma,
  requireAuth,
  requirePermission,
  scopedOrganizationId,
  validateBody
} from "@energyiq/service-kit";
import { sendEmailNotification } from "../services/email.js";

const router = Router();
router.use(requireAuth);

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const notificationQueue = new Queue("notification-dispatch", {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    password: redisUrl.password || undefined
  }
});

const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  channel: z.enum(["IN_APP", "EMAIL"]).default("IN_APP"),
  title: z.string().min(2).max(180),
  body: z.string().min(2).max(2000),
  payload: z.record(z.unknown()).default({})
});

router.get(
  "/notifications",
  requirePermission("notifications:read"),
  asyncRoute(async (request, response) => {
    const pagination = getPagination(request.query);
    const userId = request.query.userId?.toString() ?? request.principal!.userId;
    if (userId !== request.principal!.userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");
      scopedOrganizationId(request, user.organizationId);
    }

    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: "desc" }
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, status: { not: "READ" } } })
    ]);
    response.json({ items, total, unread, page: pagination.page, pageSize: pagination.pageSize });
  })
);

router.post(
  "/notifications",
  requirePermission("notifications:write"),
  validateBody(createNotificationSchema),
  asyncRoute(async (request, response) => {
    const user = await prisma.user.findUnique({ where: { id: request.body.userId } });
    if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");
    scopedOrganizationId(request, user.organizationId);

    let notification = await prisma.notification.create({ data: request.body });
    if (notification.channel === "EMAIL") {
      await sendEmailNotification(notification, user.email);
      notification = await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "SENT", sentAt: new Date() }
      });
    }
    await notificationQueue.add("dispatch-notification", { notificationId: notification.id });
    await audit(request, "notification.create", "Notification", notification.id, { channel: notification.channel });
    response.status(201).json(notification);
  })
);

router.patch(
  "/notifications/:id/read",
  requirePermission("notifications:read"),
  asyncRoute(async (request, response) => {
    const notification = await prisma.notification.findUnique({ where: { id: request.params.id?.toString() ?? "" } });
    if (!notification) throw new ApiError(404, "Notification not found", "NOTIFICATION_NOT_FOUND");
    if (notification.userId !== request.principal!.userId) {
      const user = await prisma.user.findUnique({ where: { id: notification.userId } });
      scopedOrganizationId(request, user?.organizationId);
    }
    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "READ", readAt: new Date() }
    });
    response.json(updated);
  })
);

export default router;
