import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs";
import { load } from "js-yaml";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";

/**
 * Loads src/swagger.yaml and mounts Swagger UI at /api-docs.
 *
 * Deps (add to package.json if not present):
 *   npm install swagger-ui-express js-yaml
 *   npm install -D @types/swagger-ui-express @types/js-yaml
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupSwagger(app: Express) {
  const swaggerPath = path.resolve(__dirname, "./swagger.yaml");

  if (!fs.existsSync(swaggerPath)) {
    console.warn(
      "[Swagger] swagger.yaml not found — /api-docs will not be available",
    );
    return;
  }

  const spec = load(fs.readFileSync(swaggerPath, "utf-8")) as object;

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: "E-Commerce API Docs",
      swaggerOptions: {
        persistAuthorization: true, // keeps Bearer token across page refreshes
        docExpansion: "none", // collapse all tags by default
        filter: true, // enables endpoint search bar
      },
    }),
  );

  console.log("[Swagger] Docs available at /api-docs");
}
