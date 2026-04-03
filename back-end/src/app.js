import express from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";

import routes from "./routes/index.js";

const app = express();
const JSON_BODY_LIMIT = "5mb";

function isPayloadTooLargeError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  return (
    error.type === "entity.too.large" ||
    error.status === 413 ||
    error.statusCode === 413
  );
}

app.use(helmet());
app.use(cors());
// Settings stores school logos as base64 data URLs, so we need more than the
// default 100KB JSON limit that Express ships with.
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

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

app.use((error, req, res, next) => {
  if (isPayloadTooLargeError(error)) {
    req.log?.warn?.(
      {
        type: error.type,
        status: error.status,
        limit: JSON_BODY_LIMIT,
      },
      "Request body exceeded the configured limit",
    );

    return res.status(413).json({
      error:
        "حجم الطلب كبير جدًا. الرجاء تقليل حجم الصورة أو استخدام نسخة أصغر.",
      code: "PAYLOAD_TOO_LARGE",
    });
  }

  return next(error);
});

export default app;
