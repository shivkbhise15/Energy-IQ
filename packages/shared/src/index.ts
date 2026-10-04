import { z } from "zod";

export const Roles = [
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "FACILITY_MANAGER",
  "TECHNICIAN",
  "VIEWER"
] as const;

export const DeviceTypes = [
  "HVAC",
  "COMPRESSOR",
  "MOTOR",
  "GENERATOR",
  "LIGHTING",
  "SERVER_RACK",
  "ELEVATOR",
  "WATER_PUMP"
] as const;

export const SensorTypes = [
  "VOLTAGE",
  "CURRENT",
  "POWER",
  "ENERGY_CONSUMPTION",
  "TEMPERATURE",
  "HUMIDITY"
] as const;

export const AlertLevels = ["INFO", "WARNING", "CRITICAL"] as const;
export const ForecastHorizons = ["NEXT_HOUR", "NEXT_DAY", "NEXT_WEEK", "NEXT_MONTH"] as const;

export type Role = (typeof Roles)[number];
export type DeviceType = (typeof DeviceTypes)[number];
export type SensorType = (typeof SensorTypes)[number];
export type AlertLevel = (typeof AlertLevels)[number];
export type ForecastHorizon = (typeof ForecastHorizons)[number];

export type Permission =
  | "organizations:read"
  | "organizations:write"
  | "buildings:read"
  | "buildings:write"
  | "devices:read"
  | "devices:write"
  | "sensors:read"
  | "sensors:write"
  | "readings:ingest"
  | "analytics:read"
  | "alerts:read"
  | "alerts:write"
  | "recommendations:read"
  | "forecasts:read"
  | "notifications:read"
  | "notifications:write"
  | "audit:read";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "organizations:read",
    "organizations:write",
    "buildings:read",
    "buildings:write",
    "devices:read",
    "devices:write",
    "sensors:read",
    "sensors:write",
    "readings:ingest",
    "analytics:read",
    "alerts:read",
    "alerts:write",
    "recommendations:read",
    "forecasts:read",
    "notifications:read",
    "notifications:write",
    "audit:read"
  ],
  ORG_ADMIN: [
    "organizations:read",
    "organizations:write",
    "buildings:read",
    "buildings:write",
    "devices:read",
    "devices:write",
    "sensors:read",
    "sensors:write",
    "readings:ingest",
    "analytics:read",
    "alerts:read",
    "alerts:write",
    "recommendations:read",
    "forecasts:read",
    "notifications:read",
    "notifications:write",
    "audit:read"
  ],
  FACILITY_MANAGER: [
    "organizations:read",
    "buildings:read",
    "buildings:write",
    "devices:read",
    "devices:write",
    "sensors:read",
    "sensors:write",
    "readings:ingest",
    "analytics:read",
    "alerts:read",
    "alerts:write",
    "recommendations:read",
    "forecasts:read",
    "notifications:read"
  ],
  TECHNICIAN: [
    "buildings:read",
    "devices:read",
    "devices:write",
    "sensors:read",
    "sensors:write",
    "readings:ingest",
    "alerts:read",
    "alerts:write",
    "recommendations:read",
    "notifications:read"
  ],
  VIEWER: [
    "organizations:read",
    "buildings:read",
    "devices:read",
    "sensors:read",
    "analytics:read",
    "alerts:read",
    "recommendations:read",
    "forecasts:read",
    "notifications:read"
  ]
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = "API_ERROR",
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(25),
  sortBy: z.string().optional(),
  sortDirection: z.enum(["asc", "desc"]).default("desc")
});

export function getPagination(query: unknown) {
  const parsed = pageQuerySchema.parse(query);
  return {
    ...parsed,
    skip: (parsed.page - 1) * parsed.pageSize,
    take: parsed.pageSize
  };
}

export function toProblemJson(error: unknown) {
  if (error instanceof ApiError) {
    return {
      status: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details
    };
  }

  if (error instanceof z.ZodError) {
    return {
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: error.flatten()
    };
  }

  return {
    status: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected server error"
  };
}

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(2).max(120),
  organizationName: z.string().min(2).max(160).optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(160),
  industry: z.string().min(2).max(120),
  timezone: z.string().default("UTC")
});

export const createBuildingSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2).max(160),
  address: z.string().min(4).max(240),
  city: z.string().min(2).max(120),
  country: z.string().min(2).max(120),
  areaSqFt: z.coerce.number().positive()
});

export const createDeviceSchema = z.object({
  organizationId: z.string().uuid(),
  buildingId: z.string().uuid(),
  roomId: z.string().uuid().optional(),
  name: z.string().min(2).max(160),
  type: z.enum(DeviceTypes),
  manufacturer: z.string().min(1).max(120),
  modelNumber: z.string().min(1).max(120),
  installationDate: z.coerce.date(),
  status: z.enum(["ONLINE", "OFFLINE", "MAINTENANCE", "DECOMMISSIONED"]).default("ONLINE")
});

export const createSensorSchema = z.object({
  deviceId: z.string().uuid(),
  type: z.enum(SensorTypes),
  unit: z.string().min(1).max(24),
  samplingRateSeconds: z.coerce.number().int().positive().default(60),
  calibrationOffset: z.coerce.number().default(0),
  metadata: z.record(z.unknown()).default({})
});

export const readingSchema = z.object({
  sensorId: z.string().uuid(),
  timestamp: z.coerce.date(),
  value: z.coerce.number()
});

export const ingestReadingsSchema = z.object({
  readings: z.array(readingSchema).min(1).max(10000)
});

export const forecastRequestSchema = z.object({
  buildingId: z.string().uuid().optional(),
  deviceId: z.string().uuid().optional(),
  horizon: z.enum(ForecastHorizons),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});

export type AuthPrincipal = {
  userId: string;
  organizationId: string | null;
  role: Role;
  email: string;
};

export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return Number(value);
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === "s") return amount;
  if (unit === "m") return amount * 60;
  if (unit === "h") return amount * 60 * 60;
  return amount * 24 * 60 * 60;
}
