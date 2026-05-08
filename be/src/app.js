const express = require("express");
const cors = require("cors");
const jsend = require("./jsend");
const rateLimit = require("express-rate-limit");

const devicesRouter = require("./routes/device.router");
const unitsRouter = require("./routes/unit.router");
const maintainersRouter = require("./routes/maintainer.router");
const maintenanceReportsRouter = require("./routes/maintenance_report.router");

const googleAuth = require("./middlewares/googleAuth");

const {
  resourceNotFound,
  handleError,
} = require("./controllers/errors.controller");

const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("../docs/openapiSpec.json");

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 1000,
  message: jsend.fail({
    message: "Too many requests, please try again later.",
  }),
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();
app.use(limiter);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  return res.json(
    jsend.success({
      message: "API is running",
    })
  );
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/public", express.static("public"));

// Apply Auth midleware to all API routes
app.use("/api", googleAuth);

devicesRouter.setup(app);
unitsRouter.setup(app);
maintainersRouter.setup(app);
maintenanceReportsRouter.setup(app);

// Handle 404 error for unknown URL paths
app.use(resourceNotFound);

// Define the centralized error handling middleware, after all routes
// and middlewares have been defined.
app.use(handleError);

module.exports = app;
