-- Optional production migration helper for high-volume readings.
-- Run after the Prisma-created SensorReading table exists, then create monthly partitions.
-- Prisma continues to query the parent table normally.

ALTER TABLE "SensorReading" PARTITION BY RANGE ("timestamp");

CREATE TABLE IF NOT EXISTS "SensorReading_default"
  PARTITION OF "SensorReading" DEFAULT;

-- Example monthly partition:
-- CREATE TABLE "SensorReading_2026_05"
--   PARTITION OF "SensorReading"
--   FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE INDEX IF NOT EXISTS "SensorReading_default_sensor_timestamp_idx"
  ON "SensorReading_default" ("sensorId", "timestamp" DESC);
