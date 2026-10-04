import bcrypt from "bcryptjs";
import { PrismaClient, type AlertLevel, type DeviceStatus, type DeviceType, type SensorType } from "@prisma/client";

const prisma = new PrismaClient();

const deviceTypes: DeviceType[] = [
  "HVAC",
  "COMPRESSOR",
  "MOTOR",
  "GENERATOR",
  "LIGHTING",
  "SERVER_RACK",
  "ELEVATOR",
  "WATER_PUMP"
];
const sensorTypes: SensorType[] = ["VOLTAGE", "CURRENT", "POWER", "ENERGY_CONSUMPTION", "TEMPERATURE", "HUMIDITY"];
const statuses: DeviceStatus[] = ["ONLINE", "ONLINE", "ONLINE", "MAINTENANCE", "OFFLINE"];
const alertLevels: AlertLevel[] = ["INFO", "WARNING", "CRITICAL"];
const organizationSeeds = [
  { name: "Northstar Manufacturing", industry: "Industrial Manufacturing" },
  { name: "Helios Health Network", industry: "Healthcare" },
  { name: "MetroGrid Data Campus", industry: "Data Centers" }
] as const;

function pick<T>(items: T[], index: number): T {
  return items[index % items.length]!;
}

function deterministicValue(seed: number, min: number, max: number) {
  const x = Math.sin(seed) * 10000;
  const fractional = x - Math.floor(x);
  return Math.round((min + fractional * (max - min)) * 100) / 100;
}

async function main() {
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.maintenanceReport.deleteMany();
  await prisma.forecast.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.sensorReading.deleteMany();
  await prisma.sensor.deleteMany();
  await prisma.device.deleteMany();
  await prisma.room.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.floor.deleteMany();
  await prisma.building.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const passwordHash = await bcrypt.hash("EnergyIQ-Demo-2026!", 12);
  const organizations = await Promise.all(
    organizationSeeds.map(({ name, industry }) =>
      prisma.organization.create({
        data: {
          name,
          industry,
          timezone: "Asia/Kolkata",
          users: {
            create: {
              email: `${name.toLowerCase().replaceAll(" ", ".")}@energyiq.local`,
              name: `${name} Admin`,
              passwordHash,
              role: "ORG_ADMIN"
            }
          }
        }
      })
    )
  );

  await prisma.user.create({
    data: {
      email: "superadmin@energyiq.local",
      name: "EnergyIQ Super Admin",
      passwordHash,
      role: "SUPER_ADMIN"
    }
  });

  const buildings = [];
  for (let i = 0; i < 10; i += 1) {
    const organization = pick(organizations, i);
    const building = await prisma.building.create({
      data: {
        organizationId: organization.id,
        name: `Building ${String.fromCharCode(65 + i)}`,
        address: `${100 + i} Gridline Avenue`,
        city: pick(["Mumbai", "Bengaluru", "Pune", "Hyderabad"], i),
        country: "India",
        areaSqFt: 45000 + i * 7200
      }
    });
    buildings.push(building);

    for (let f = 0; f < 3; f += 1) {
      const floor = await prisma.floor.create({
        data: {
          buildingId: building.id,
          label: f === 0 ? "Ground" : `Level ${f}`,
          level: f
        }
      });
      const zone = await prisma.zone.create({
        data: {
          buildingId: building.id,
          floorId: floor.id,
          name: `Zone ${f + 1}`
        }
      });
      for (let r = 0; r < 3; r += 1) {
        await prisma.room.create({
          data: {
            buildingId: building.id,
            floorId: floor.id,
            zoneId: zone.id,
            name: `Room ${f + 1}-${r + 1}`
          }
        });
      }
    }
  }

  const rooms = await prisma.room.findMany();
  const devices = [];
  for (let i = 0; i < 100; i += 1) {
    const building = pick(buildings, i);
    const room = pick(
      rooms.filter((candidate) => candidate.buildingId === building.id),
      i
    );
    const type = pick(deviceTypes, i);
    const device = await prisma.device.create({
      data: {
        organizationId: building.organizationId,
        buildingId: building.id,
        roomId: room.id,
        name: `${type.replace("_", " ")} ${i + 1}`,
        type,
        manufacturer: pick(["Schneider", "Siemens", "ABB", "Honeywell", "Eaton"], i),
        modelNumber: `EIQ-${type.slice(0, 3)}-${1000 + i}`,
        installationDate: new Date(2020 + (i % 5), i % 12, 1 + (i % 20)),
        status: pick(statuses, i)
      }
    });
    devices.push(device);
  }

  const sensors = [];
  for (let i = 0; i < 500; i += 1) {
    const device = pick(devices, i);
    const type = pick(sensorTypes, i);
    const unit = type === "ENERGY_CONSUMPTION" ? "kWh" : type === "POWER" ? "kW" : type === "TEMPERATURE" ? "C" : type === "HUMIDITY" ? "%" : type === "VOLTAGE" ? "V" : "A";
    sensors.push(
      await prisma.sensor.create({
        data: {
          deviceId: device.id,
          type,
          unit,
          samplingRateSeconds: type === "ENERGY_CONSUMPTION" ? 300 : 60,
          metadata: {
            firmware: `v${1 + (i % 3)}.${i % 10}`,
            precision: type === "VOLTAGE" ? "0.5%" : "1%"
          }
        }
      })
    );
  }

  const now = new Date();
  for (let batch = 0; batch < 20; batch += 1) {
    const data = [];
    for (let i = 0; i < sensors.length; i += 1) {
      const sensor = sensors[i]!;
      const hoursAgo = batch * 2;
      const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
      const baseline = sensor.type === "ENERGY_CONSUMPTION" ? 45 : sensor.type === "POWER" ? 80 : sensor.type === "TEMPERATURE" ? 24 : 220;
      data.push({
        sensorId: sensor.id,
        timestamp,
        value: deterministicValue(i + batch, baseline * 0.72, baseline * 1.36)
      });
    }
    await prisma.sensorReading.createMany({ data, skipDuplicates: true });
  }

  for (let i = 0; i < 18; i += 1) {
    const device = pick(devices, i * 3);
    await prisma.alert.create({
      data: {
        organizationId: device.organizationId,
        buildingId: device.buildingId,
        deviceId: device.id,
        level: pick(alertLevels, i),
        title: `${device.name} abnormal usage`,
        description: `${device.name} exceeded its historical baseline during the last operating window.`,
        anomalyScore: deterministicValue(i, 0.61, 0.98),
        confidenceScore: deterministicValue(i + 9, 0.72, 0.96)
      }
    });
  }

  for (let i = 0; i < 24; i += 1) {
    const device = pick(devices, i * 4);
    await prisma.recommendation.create({
      data: {
        organizationId: device.organizationId,
        deviceId: device.id,
        title: `${device.name} optimization opportunity`,
        narrative: `${device.name} is trending ${Math.round(deterministicValue(i, 12, 31))}% above comparable equipment after-hours. Inspect controls, filters, and occupancy schedules.`,
        impact: pick(["LOW", "MEDIUM", "HIGH"], i),
        estimatedSavingsUsd: deterministicValue(i + 15, 900, 8400)
      }
    });
  }

  for (let i = 0; i < 40; i += 1) {
    const building = pick(buildings, i);
    await prisma.forecast.create({
      data: {
        organizationId: building.organizationId,
        buildingId: building.id,
        horizon: pick(["NEXT_HOUR", "NEXT_DAY", "NEXT_WEEK", "NEXT_MONTH"], i),
        targetDate: new Date(now.getTime() + (i + 1) * 60 * 60 * 1000),
        predictedKwh: deterministicValue(i + 3, 480, 9500),
        predictedCost: deterministicValue(i + 5, 120, 2200),
        confidenceLow: deterministicValue(i + 6, 420, 8800),
        confidenceHigh: deterministicValue(i + 7, 620, 10400),
        modelVersion: "energyiq-baseline-0.1"
      }
    });
  }

  for (let i = 0; i < 15; i += 1) {
    const device = pick(devices, i * 5);
    await prisma.incident.create({
      data: {
        organizationId: device.organizationId,
        deviceId: device.id,
        title: `${device.name} efficiency degradation`,
        severity: pick(alertLevels, i),
        summary: "Similar incidents were associated with clogged filters, bearing wear, or misconfigured schedules.",
        rootCause: i % 2 === 0 ? "Airflow restriction" : "Control schedule drift",
        resolution: "Maintenance team inspected equipment and recalibrated operating thresholds.",
        occurredAt: new Date(now.getTime() - (i + 2) * 24 * 60 * 60 * 1000)
      }
    });
  }

  console.log("Seeded EnergyIQ demo data.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
