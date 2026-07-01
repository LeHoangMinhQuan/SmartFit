import "./config/env.js"; // validates env vars — must be first

import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";

import { swaggerSpec } from "./config/swagger.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";

// Route imports
import authRoutes from './routes/auth.routes.js';
import userRoutes from "./routes/user.routes.js";
import productRoutes, {
  attributeRouter,
  categoryRouter,
} from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import paymentRoutes from "./routes/payment.routes.js";  
import shippingRoutes from "./routes/shipping.routes.js";
import voucherRoutes from "./routes/voucher.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import tryonRoutes from "./routes/tryon.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import reviewRoutes from "./routes/review.routes.js";

const app = express();

// ─── Security & CORS ──────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env["FRONTEND_URL"] ?? "http://localhost:3001",
    credentials: true,
  }),
);

// ─── ⚠️  VNPay IPN MUST be registered BEFORE express.json() ──────────────────
// VNPay sends IPN as application/x-www-form-urlencoded.
// The payment router handles its own urlencoded() middleware on the IPN route.
app.use('/api/payments', paymentRoutes);
 
// ─── Body parsing (after IPN route) ──────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
 
// ─── Static files ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static('public/uploads'));
 
// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);
 
// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});
 
// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/attributes', attributeRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/tryon', tryonRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/admin', adminRoutes);

// ─── Swagger UI ───────────────────────────────────────────────────────────────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── 404 + error handler — must be last ──────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
