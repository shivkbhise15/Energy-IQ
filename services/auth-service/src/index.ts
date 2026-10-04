import authRouter from "./routes/auth.routes.js";
import { startService } from "@energyiq/service-kit";

startService("auth-service", Number(process.env.PORT ?? 4101), authRouter);
