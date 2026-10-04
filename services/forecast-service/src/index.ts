import forecastRouter from "./routes/forecast.routes.js";
import { startService } from "@energyiq/service-kit";

startService("forecast-service", Number(process.env.PORT ?? 4105), forecastRouter);
