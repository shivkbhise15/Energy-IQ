export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "EnergyIQ API",
    version: "0.1.0",
    description: "REST API surface for the EnergyIQ energy intelligence platform."
  },
  servers: [{ url: "/api" }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  },
  paths: {
    "/auth/register": { post: { tags: ["Auth"], summary: "Register an organization administrator" } },
    "/auth/login": { post: { tags: ["Auth"], summary: "Exchange credentials for JWT tokens" } },
    "/auth/refresh": { post: { tags: ["Auth"], summary: "Rotate refresh token and return new access token" } },
    "/organizations": { get: { tags: ["Organizations"], summary: "List organizations" }, post: { tags: ["Organizations"], summary: "Create organization" } },
    "/buildings": { get: { tags: ["Organizations"], summary: "List buildings" }, post: { tags: ["Organizations"], summary: "Create building" } },
    "/devices": { get: { tags: ["Devices"], summary: "List devices" }, post: { tags: ["Devices"], summary: "Create device" } },
    "/sensors": { get: { tags: ["Devices"], summary: "List sensors" }, post: { tags: ["Devices"], summary: "Create sensor" } },
    "/readings": { post: { tags: ["Readings"], summary: "Ingest batched sensor readings" } },
    "/dashboard": { get: { tags: ["Analytics"], summary: "Executive dashboard metrics" } },
    "/forecasts": { get: { tags: ["Forecasts"], summary: "List forecasts" }, post: { tags: ["Forecasts"], summary: "Generate forecast" } },
    "/notifications": { get: { tags: ["Notifications"], summary: "List in-app notifications" } }
  }
};
