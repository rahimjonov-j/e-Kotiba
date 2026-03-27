import { env } from "../config/env.js";

export const corsOptions = {
  origin(origin, cb) {
    if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("CORS blocked"));
  },
  credentials: true,
};