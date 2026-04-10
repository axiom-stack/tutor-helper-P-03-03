import app from "./app.js";

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
const isProduction = process.env.NODE_ENV === "production";

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server is running on http://${HOST}:${PORT}`);
  console.log(
    isProduction
      ? "📊 Logs are emitted in plain JSON for production"
      : "📊 Logs are formatted with pino-pretty",
  );
  console.log(`🔐 JWT auth available at /api/auth`);
});
