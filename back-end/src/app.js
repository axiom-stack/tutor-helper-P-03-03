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
app.use(pinoHttp());

app.use("/api", routes);

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Server is running",
  });
});

export default app;
