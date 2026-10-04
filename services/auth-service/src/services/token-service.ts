import crypto from "node:crypto";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { parseDurationToSeconds, type AuthPrincipal } from "@energyiq/shared";
import { prisma } from "@energyiq/service-kit";

const accessSecret: Secret = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";
const refreshSecret: Secret = process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret";

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createOpaqueToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function issueAccessToken(principal: AuthPrincipal) {
  const expiresIn = (process.env.ACCESS_TOKEN_TTL ?? "15m") as SignOptions["expiresIn"];
  return jwt.sign(principal, accessSecret, {
    expiresIn,
    issuer: "energyiq"
  });
}

export async function issueRefreshToken(userId: string, ipAddress?: string) {
  const expiresIn = `${process.env.REFRESH_TOKEN_TTL_DAYS ?? "30"}d` as SignOptions["expiresIn"];
  const refreshToken = jwt.sign({ sub: userId, nonce: createOpaqueToken() }, refreshSecret, {
    expiresIn,
    issuer: "energyiq"
  });
  const expiresAt = new Date(Date.now() + Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30) * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
      createdByIp: ipAddress
    }
  });
  return refreshToken;
}

export async function issueTokenPair(user: {
  id: string;
  organizationId: string | null;
  role: AuthPrincipal["role"];
  email: string;
}, ipAddress?: string) {
  const principal: AuthPrincipal = {
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
    email: user.email
  };
  return {
    accessToken: issueAccessToken(principal),
    refreshToken: await issueRefreshToken(user.id, ipAddress),
    expiresIn: parseDurationToSeconds(process.env.ACCESS_TOKEN_TTL ?? "15m")
  };
}
