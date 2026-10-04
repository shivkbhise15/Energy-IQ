import analyticsRouter from "./routes/analytics.routes.js";
import { startService } from "@energyiq/service-kit";

startService("analytics-service", Number(process.env.PORT ?? 4104), analyticsRouter);
