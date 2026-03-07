import app from "./app.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Logs are formatted with pino-pretty`);
  console.log(`🔐 JWT auth available at /api/auth`);
});