import app from "./app.js";

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server is running on http://${HOST}:${PORT}`);
  console.log(`📊 Logs are formatted with pino-pretty`);
  console.log(`🔐 JWT auth available at /api/auth`);
});