import { createApp } from "./app.js";
import { env, assertRequiredEnv } from "./config/env.js";
import { startSchedulers } from "./jobs/scheduler.js";

assertRequiredEnv();

const app = createApp();

app.listen(env.port, () => {
  console.log(`Backend running on port ${env.port}`);
  startSchedulers();
});