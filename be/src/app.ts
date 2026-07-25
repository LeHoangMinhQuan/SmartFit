import { env } from "./config/env.js"; // validates env vars — must be first

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { setupSwagger } from "./config/swagger.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";

// Route imports
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import productRoutes, {
  attributeRouter,
  categoryRouter,
} from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import paymentRoutes, { paymentIpnRouter } from "./routes/payment.routes.js";
import shippingRoutes from "./routes/shipping.routes.js";
import voucherRoutes from "./routes/voucher.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import tryonRoutes from "./routes/tryon.routes.js";
import adminTryonRoutes from "./routes/admin/tryon.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import supplierRoutes from "./routes/supplier.routes.js";

const app = express();

// Trust the first proxy in front of Express (CLoudflare Proxy)
app.set("trust proxy", 1);

// ─── Security & CORS ──────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(cookieParser());

// ─── ⚠️  VNPay IPN MUST be registered BEFORE express.json() ──────────────────
// VNPay sends IPN as application/x-www-form-urlencoded.
// Only the IPN-only router is mounted here — it applies its own
// urlencoded() middleware on that one route. The rest of paymentRoutes
// (/vnpay/create, /vnpay/return) is mounted below, after body parsing,
// so req.body is actually populated for them.
app.use("/api/payments", paymentIpnRouter);

// ─── Body parsing (after IPN route) ──────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static files ─────────────────────────────────────────────────────────────
app.use("/uploads", express.static("public/uploads"));

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use("/api/", apiLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/attributes", attributeRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/vouchers", voucherRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/tryon", tryonRoutes);
app.use("/api/admin/tryon", adminTryonRoutes);
app.use("/api/admin/suppliers", supplierRoutes);
app.use("/api/admin", adminRoutes);

// ─── Swagger UI ───────────────────────────────────────────────────────────────
setupSwagger(app);

// ─── 404 + error handler — must be last ──────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
