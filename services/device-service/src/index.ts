import deviceRouter from "./routes/device.routes.js";
import { startService } from "@energyiq/service-kit";

startService("device-service", Number(process.env.PORT ?? 4103), deviceRouter);
