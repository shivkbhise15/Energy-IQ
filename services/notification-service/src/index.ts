import notificationRouter from "./routes/notification.routes.js";
import { startService } from "@energyiq/service-kit";

startService("notification-service", Number(process.env.PORT ?? 4106), notificationRouter);
