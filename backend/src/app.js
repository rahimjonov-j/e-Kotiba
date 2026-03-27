import express from "express";
import cors from "cors";
import helmet from "helmet";
import { corsOptions } from "./config/cors.js";
import { apiRateLimit } from "./middlewares/rateLimit.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";
import routes from "./routes/index.js";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "15mb" }));
  app.use(apiRateLimit);

  app.use("/api", routes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
};