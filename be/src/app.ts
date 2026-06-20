import "./config/env.js"; // validates env vars — must be first

import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";

import { swaggerSpec } from "./config/swagger.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";

// ─── Route imports ────────────────────────────────────────────────────────────
import authRoutes from "./routes/auth.routes.js";
// TODO: Uncomment these route imports when ready to implement each feature
// import staffAuthRoutes from "./routes/staffAuth.routes";
// import productRoutes from "./routes/product.routes";
// import categoryRoutes from "./routes/category.routes";
// import cartRoutes from "./routes/cart.routes";
// import orderRoutes from "./routes/order.routes";
// import paymentRoutes from "./routes/payment.routes";
// import shippingRoutes from "./routes/shipping.routes";
// import userRoutes from "./routes/user.routes";
// import uploadRoutes from "./routes/upload.routes";
// import voucherRoutes from "./routes/voucher.routes";
// import inventoryRoutes from "./routes/inventory.routes";
// import staffRoutes from "./routes/staff.routes";
// import storeRoutes from "./routes/store.routes";
// import supplierRoutes from "./routes/supplier.routes";
// import discountRoutes from "./routes/discount.routes";
// import tryonRoutes from "./routes/tryon.routes";
// import adminRoutes from "./routes/admin.routes";

const app = express();

// ─── Security & CORS ──────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());

// ─── VNPay IPN — must be registered BEFORE express.json() (§8) ───────────────
// IPN sends application/x-www-form-urlencoded, not JSON.
// Registering it here with its own parser ensures the raw body is intact
// for HMAC-SHA512 verification. Do NOT move this below express.json().

// TODO: Comment for dev test,uncomment later
// import { ipnController } from "./controllers/payment.controller";
// app.post(
//   "/api/payments/vnpay/ipn",
//   express.urlencoded({ extended: false }),
//   ipnController,
// );

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json());

// ─── Global rate limiter ──────────────────────────────────────────────────────
app.use(globalLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
// TODO: Uncomment these route registrations when ready to implement each feature
// app.use("/api/staff/auth", staffAuthRoutes);
// app.use("/api/products", productRoutes);
// app.use("/api/categories", categoryRoutes);
// app.use("/api/cart", cartRoutes);
// app.use("/api/orders", orderRoutes);
// app.use("/api/payments", paymentRoutes); // excludes /ipn — already registered above
// app.use("/api/shipping", shippingRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/uploads", uploadRoutes);
// app.use("/api/vouchers", voucherRoutes);
// app.use("/api/inventory", inventoryRoutes);
// app.use("/api/discounts", discountRoutes);
// app.use("/api/tryon", tryonRoutes);
// app.use("/api/admin/staff", staffRoutes);
// app.use("/api/admin/stores", storeRoutes);
// app.use("/api/admin/suppliers", supplierRoutes);
// app.use("/api/admin", adminRoutes); // covers /users, /orders, /reviews, /dashboard, /vouchers

// ─── Swagger UI ───────────────────────────────────────────────────────────────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── 404 + error handler — must be last ──────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
