import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pino from "pino";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import proxyRouter from "./routes/proxy.js";
import { openApiDocument } from "./openapi.js";

const logger = pino({ name: "api-gateway", level: process.env.LOG_LEVEL ?? "info" });
const app = express();
const port = Number(process.env.API_GATEWAY_PORT ?? 8080);

app.disable("x-powered-by");
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: process.env.FRONTEND_URL?.split(",") ?? ["http://localhost:5173"],
    credentials: true
  })
);
app.use(pinoHttp({ logger }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    limit: 600,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

app.get("/health/live", (_request, response) => response.json({ service: "api-gateway", status: "live" }));
app.get("/health/ready", (_request, response) => response.json({ service: "api-gateway", status: "ready" }));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.use("/api", proxyRouter);

app.listen(port, () => logger.info({ port }, "api gateway started"));
