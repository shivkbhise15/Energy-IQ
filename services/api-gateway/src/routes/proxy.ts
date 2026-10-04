import { Router } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const router = Router();

const targets = {
  "/auth": process.env.AUTH_SERVICE_URL ?? "http://localhost:4101",
  "/organizations": process.env.ORGANIZATION_SERVICE_URL ?? "http://localhost:4102",
  "/buildings": process.env.ORGANIZATION_SERVICE_URL ?? "http://localhost:4102",
  "/floors": process.env.ORGANIZATION_SERVICE_URL ?? "http://localhost:4102",
  "/zones": process.env.ORGANIZATION_SERVICE_URL ?? "http://localhost:4102",
  "/rooms": process.env.ORGANIZATION_SERVICE_URL ?? "http://localhost:4102",
  "/audit-logs": process.env.ORGANIZATION_SERVICE_URL ?? "http://localhost:4102",
  "/devices": process.env.DEVICE_SERVICE_URL ?? "http://localhost:4103",
  "/sensors": process.env.DEVICE_SERVICE_URL ?? "http://localhost:4103",
  "/readings": process.env.DEVICE_SERVICE_URL ?? "http://localhost:4103",
  "/alerts": process.env.DEVICE_SERVICE_URL ?? "http://localhost:4103",
  "/dashboard": process.env.ANALYTICS_SERVICE_URL ?? "http://localhost:4104",
  "/analytics": process.env.ANALYTICS_SERVICE_URL ?? "http://localhost:4104",
  "/forecasts": process.env.FORECAST_SERVICE_URL ?? "http://localhost:4105",
  "/ai": process.env.AI_SERVICE_URL ?? "http://localhost:8000",
  "/notifications": process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:4106"
};

for (const [path, target] of Object.entries(targets)) {
  router.use(
    path,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: { "^/": `${path}/` },
      proxyTimeout: 30000,
      timeout: 30000
    })
  );
}

export default router;
