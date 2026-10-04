import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { ApiError, loginSchema, registerSchema } from "@energyiq/shared";
import { asyncRoute, audit, prisma, requireAuth, validateBody } from "@energyiq/service-kit";
import { createOpaqueToken, hashToken, issueTokenPair } from "../services/token-service.js";

const router = Router();

const refreshSchema = z.object({ refreshToken: z.string().min(20) });
const passwordResetRequestSchema = z.object({ email: z.string().email() });
const passwordResetConfirmSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(12)
});

router.post(
  "/auth/register",
  validateBody(registerSchema),
  asyncRoute(async (request, response) => {
    const { email, password, name, organizationName } = request.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, "Email is already registered", "EMAIL_EXISTS");

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const organization = organizationName
        ? await tx.organization.create({
            data: {
              name: organizationName,
              industry: "Unspecified",
              timezone: "UTC"
            }
          })
        : null;

      return tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          organizationId: organization?.id,
          role: organization ? "ORG_ADMIN" : "VIEWER"
        }
      });
    });

    const tokens = await issueTokenPair(user, request.ip);
    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: "auth.register",
        entityType: "User",
        entityId: user.id,
        ipAddress: request.ip,
        userAgent: request.header("user-agent"),
        metadata: { email: user.email }
      }
    });

    response.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId },
      ...tokens
    });
  })
);

router.post(
  "/auth/login",
  validateBody(loginSchema),
  asyncRoute(async (request, response) => {
    const { email, password } = request.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new ApiError(401, "Invalid credentials", "INVALID_CREDENTIALS");

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) throw new ApiError(401, "Invalid credentials", "INVALID_CREDENTIALS");

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await issueTokenPair(user, request.ip);
    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: "auth.login",
        entityType: "User",
        entityId: user.id,
        ipAddress: request.ip,
        userAgent: request.header("user-agent")
      }
    });

    response.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId },
      ...tokens
    });
  })
);

router.post(
  "/auth/refresh",
  validateBody(refreshSchema),
  asyncRoute(async (request, response) => {
    const { refreshToken } = request.body;
    try {
      jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret");
    } catch {
      throw new ApiError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date() || !stored.user.isActive) {
      throw new ApiError(401, "Refresh token is not active", "INVALID_REFRESH_TOKEN");
    }

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const tokens = await issueTokenPair(stored.user, request.ip);
    response.json(tokens);
  })
);

router.post(
  "/auth/logout",
  validateBody(refreshSchema),
  asyncRoute(async (request, response) => {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(request.body.refreshToken), revokedAt: null },
      data: { revokedAt: new Date() }
    });
    response.status(204).send();
  })
);

router.post(
  "/auth/password-reset/request",
  validateBody(passwordResetRequestSchema),
  asyncRoute(async (request, response) => {
    const user = await prisma.user.findUnique({ where: { email: request.body.email } });
    if (!user) return response.status(202).json({ accepted: true });

    const resetToken = createOpaqueToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(resetToken),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      }
    });
    response.status(202).json({
      accepted: true,
      devResetToken: process.env.NODE_ENV === "production" ? undefined : resetToken
    });
  })
);

router.post(
  "/auth/password-reset/confirm",
  validateBody(passwordResetConfirmSchema),
  asyncRoute(async (request, response) => {
    const tokenHash = hashToken(request.body.token);
    const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!token || token.usedAt || token.expiresAt <= new Date()) {
      throw new ApiError(400, "Reset token is invalid or expired", "INVALID_RESET_TOKEN");
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: token.userId },
        data: { passwordHash: await bcrypt.hash(request.body.password, 12) }
      }),
      prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({ where: { userId: token.userId, revokedAt: null }, data: { revokedAt: new Date() } })
    ]);
    response.status(204).send();
  })
);

router.get(
  "/auth/me",
  requireAuth,
  asyncRoute(async (request, response) => {
    const user = await prisma.user.findUnique({
      where: { id: request.principal!.userId },
      select: { id: true, email: true, name: true, role: true, organizationId: true, organization: true }
    });
    if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");
    await audit(request, "auth.me", "User", user.id);
    response.json(user);
  })
);

export default router;
