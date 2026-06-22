/**
 * config/swagger.ts
 *
 * Builds the OpenAPI 3.0 specification object consumed by swagger-ui-express.
 * Mounted in app.ts at GET /api-docs.
 *
 * TODO: Replace remaining placeholder path stubs with real JSDoc @swagger
 * annotations on each route file, then use swagger-jsdoc to auto-generate
 * from them:
 *
 *   import swaggerJsdoc from 'swagger-jsdoc';
 *   export const swaggerSpec = swaggerJsdoc(options);
 *
 * Auth paths below (register/login/refresh/logout) are fully wired and
 * testable via "Try it out" in Swagger UI against a running server. Other
 * domains (products, orders, try-on, etc.) are still placeholder stubs.
 *
 * Packages to install when ready for full annotation:
 *   npm i swagger-jsdoc
 *   npm i -D @types/swagger-jsdoc
 */

import type { OpenAPIV3 } from "openapi-types";

// ── Re-usable schema fragments ─────────────────────────────────────────────────

const errorSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    status: { type: "string", example: "error" },
    statusCode: { type: "integer", example: 404 },
    message: { type: "string", example: "Resource not found" },
    details: {
      type: "array",
      nullable: true,
      items: {
        type: "object",
        properties: {
          field: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
};

const paginationMeta: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    page: { type: "integer", example: 1 },
    limit: { type: "integer", example: 20 },
    total: { type: "integer", example: 142 },
    totalPages: { type: "integer", example: 8 },
  },
};

const bearerAuth: OpenAPIV3.SecuritySchemeObject = {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "User access token — obtain via POST /api/auth/login",
};

const staffBearerAuth: OpenAPIV3.SecuritySchemeObject = {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Staff access token — obtain via POST /api/staff/auth/login",
};

// ── Auth schemas ────────────────────────────────────────────────────────────
// user_id is GENERATED ALWAYS AS IDENTITY — never accepted in request bodies,
// always present (and DB-assigned) in responses.

const userPublic: OpenAPIV3.SchemaObject = {
  type: "object",
  description: "Public-safe user fields returned by register/login.",
  properties: {
    user_id: {
      type: "integer",
      readOnly: true,
      description:
        "GENERATED ALWAYS AS IDENTITY — assigned by the DB, never sent by the client.",
      example: 42,
    },
    username: { type: "string", example: "jane_doe" },
    email: { type: "string", format: "email", example: "jane@example.com" },
    phone: {
      type: "string",
      minLength: 10,
      maxLength: 10,
      description: "CHAR(10) — exactly 10 digits.",
      example: "0901234567",
    },
    address: { type: "string", maxLength: 70, example: "123 Le Loi, Q1, HCMC" },
    avatar_url: {
      type: "string",
      format: "uri",
      nullable: true,
      example: null,
    },
    created_at: { type: "string", format: "date-time", readOnly: true },
  },
  required: ["user_id", "username", "email", "phone", "address"],
};

const registerBody: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    username: {
      type: "string",
      minLength: 3,
      maxLength: 50,
      example: "jane_doe",
    },
    email: {
      type: "string",
      format: "email",
      maxLength: 50,
      example: "jane@example.com",
    },
    password: {
      type: "string",
      format: "password",
      minLength: 8,
      example: "correct-horse-battery-staple",
    },
    phone: {
      type: "string",
      minLength: 10,
      maxLength: 10,
      description: "CHAR(10) — exactly 10 digits, no spaces or dashes.",
      example: "0901234567",
    },
    address: {
      type: "string",
      maxLength: 70,
      description: "VARCHAR(70) — free-text delivery address.",
      example: "123 Le Loi, Q1, HCMC",
    },
  },
  required: ["username", "email", "password", "phone", "address"],
};

const loginBody: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    email: { type: "string", format: "email", example: "jane@example.com" },
    password: {
      type: "string",
      format: "password",
      example: "correct-horse-battery-staple",
    },
  },
  required: ["email", "password"],
};

const authResult: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    user: { $ref: "#/components/schemas/UserPublic" },
    accessToken: {
      type: "string",
      description:
        "Short-lived JWT (15 min TTL). Send as `Authorization: Bearer <accessToken>`.",
    },
    refreshToken: {
      type: "string",
      description:
        "Long-lived opaque token (7 day TTL). Only the hash is stored server-side in refresh_token.token_hash; the row's token_id is GENERATED ALWAYS AS IDENTITY.",
    },
  },
  required: ["user", "accessToken", "refreshToken"],
};

const refreshBody: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    refreshToken: { type: "string" },
  },
  required: ["refreshToken"],
};

const refreshResult: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    accessToken: { type: "string" },
    refreshToken: {
      type: "string",
      description:
        "Rotated refresh token — the old one is deleted and a new row (new token_id) is inserted.",
    },
  },
  required: ["accessToken", "refreshToken"],
};

const logoutBody: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    refreshToken: { type: "string" },
  },
  required: ["refreshToken"],
};

// ── Spec ──────────────────────────────────────────────────────────────────────

export const swaggerSpec: OpenAPIV3.Document = {
  openapi: "3.0.3",

  info: {
    title: "E-Commerce API",
    version: "1.0.0",
    description: [
      "REST API for the e-commerce platform.",
      "",
      "**Authentication**",
      "- Customer routes: `Authorization: Bearer <user_access_token>`",
      "- Staff/admin routes: `Authorization: Bearer <staff_access_token>`",
      "",
      "**Pagination** — all list endpoints accept `?page=1&limit=20` (max 100).",
      "",
      "**Try it out** — the Auth section below is fully wired against a running",
      "server. Use Register or Login to get an `accessToken`, then click the",
      "🔓 **Authorize** button at the top of this page and paste it in to unlock",
      "any routes that require `bearerAuth`.",
    ].join("\n"),
    contact: {
      name: "API Support",
      email: "support@example.com",
    },
  },

  servers: [
    { url: "http://localhost:3000", description: "Local development" },
    { url: "https://api.example.com", description: "Production" },
  ],

  components: {
    securitySchemes: {
      bearerAuth,
      staffBearerAuth,
    },
    schemas: {
      Error: errorSchema,
      PaginationMeta: paginationMeta,

      UserPublic: userPublic,
      RegisterBody: registerBody,
      LoginBody: loginBody,
      AuthResult: authResult,
      RefreshBody: refreshBody,
      RefreshResult: refreshResult,
      LogoutBody: logoutBody,

      // ── Placeholder schemas — replace with real definitions ────────────────
      // Each should mirror the corresponding Zod schema in src/schemas/.

      Product: {
        type: "object",
        description: "TODO: fill from product.schema.ts",
        properties: {
          product_id: {
            type: "integer",
            readOnly: true,
            description: "GENERATED ALWAYS AS IDENTITY",
          },
          name: { type: "string" },
          description: { type: "string" },
        },
      },

      Order: {
        type: "object",
        description: "TODO: fill from order.schema.ts",
        properties: {
          order_id: {
            type: "integer",
            readOnly: true,
            description: "GENERATED ALWAYS AS IDENTITY",
          },
          status: { type: "string" },
          total_amount: { type: "number" },
        },
      },

      TryonSession: {
        type: "object",
        properties: {
          session_id: {
            type: "integer",
            readOnly: true,
            description: "GENERATED ALWAYS AS IDENTITY",
          },
          expires_at: {
            type: "string",
            format: "date-time",
            description:
              "Defaults to NOW() + INTERVAL '1 hour' at the DB level.",
          },
        },
      },

      TryonPreviewResult: {
        type: "object",
        properties: {
          session_id: { type: "integer" },
          status: { type: "string", enum: ["processing", "ready", "failed"] },
          result_url: { type: "string", format: "uri", nullable: true },
          expires_at: { type: "string", format: "date-time", nullable: true },
        },
      },
    },

    responses: {
      400: {
        description: "Bad Request / Validation Error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      401: {
        description: "Unauthorized — missing or invalid token",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      403: {
        description: "Forbidden — insufficient role",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      404: {
        description: "Not Found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      409: {
        description: "Conflict — e.g. duplicate email",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      429: {
        description: "Too Many Requests",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      500: {
        description: "Internal Server Error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },

    parameters: {
      pageParam: {
        name: "page",
        in: "query",
        schema: { type: "integer", default: 1 },
        description: "Page number (1-based)",
      },
      limitParam: {
        name: "limit",
        in: "query",
        schema: { type: "integer", default: 20, maximum: 100 },
        description: "Items per page",
      },
    },
  },

  // ── Paths ──────────────────────────────────────────────────────────────────

  paths: {
    "/api/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: {
          200: {
            description: "API is running",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    uptime: { type: "number", example: 42.5 },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/api/auth/register": {
      post: {
        tags: ["Auth (Users)"],
        summary: "Register a new user account",
        description:
          'Creates a row in "USER". user_id is GENERATED ALWAYS AS IDENTITY — do not send it; it comes back in the response.',
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterBody" },
            },
          },
        },
        responses: {
          201: {
            description: "Account created — tokens issued immediately",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResult" },
              },
            },
          },
          400: { $ref: "#/components/responses/400" },
          409: { $ref: "#/components/responses/409" },
        },
      },
    },

    "/api/auth/login": {
      post: {
        tags: ["Auth (Users)"],
        summary: "Log in with email + password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Login successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResult" },
              },
            },
          },
          400: { $ref: "#/components/responses/400" },
          401: {
            description: "Invalid email or password",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },

    "/api/auth/refresh": {
      post: {
        tags: ["Auth (Users)"],
        summary: "Rotate refresh token",
        description:
          "Verifies the refresh token hash against refresh_token, deletes the old row, and inserts a new one (new DB-generated token_id) along with a fresh access token.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RefreshBody" },
            },
          },
        },
        responses: {
          200: {
            description: "New token pair issued",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RefreshResult" },
              },
            },
          },
          401: { $ref: "#/components/responses/401" },
        },
      },
    },

    "/api/auth/logout": {
      post: {
        tags: ["Auth (Users)"],
        summary: "Log out — revoke a refresh token",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LogoutBody" },
            },
          },
        },
        responses: {
          204: { description: "Logged out — refresh_token row deleted" },
          401: { $ref: "#/components/responses/401" },
        },
      },
    },

    // TODO: add stubs for products, orders, try-on, etc.
    // Or migrate to swagger-jsdoc annotations on route files.
  },
};
