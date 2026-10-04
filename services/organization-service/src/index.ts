import organizationRouter from "./routes/organization.routes.js";
import { startService } from "@energyiq/service-kit";

startService("organization-service", Number(process.env.PORT ?? 4102), organizationRouter);
