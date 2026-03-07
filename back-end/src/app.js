import express from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";

import routes from "./routes/index.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure pino-http for cleaner, more readable logs
app.use(
  pinoHttp({
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore:
          "pid,hostname,req.id,req.remoteAddress,req.remotePort,res.headers",
      },
    },
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 400 && res.statusCode < 500) {
        return "warn";
      } else if (res.statusCode >= 500 || err) {
        return "error";
      }
      return "info";
    },
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} - ${res.statusCode}`;
    },
    customErrorMessage: (req, res, err) => {
      return `${req.method} ${req.url} - ${res.statusCode} - Error: ${err?.message || "Unknown error"}`;
    },
  }),
);

app.use("/api", routes);

app.get("/health", (req, res) => {
  req.log.info("Health check requested");
  res.status(200).json({
    ok: true,
    message: "Server is running",
  });
});

export default app;
