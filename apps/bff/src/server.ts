import { pathToFileURL } from "node:url";
import Fastify from "fastify";
import { BadRequest } from "./envelope.ts";
import { startAlertJob } from "./jobs/alerts.ts";
import { alertRoutes } from "./routes/alerts.ts";
import { forecastRoutes } from "./routes/forecast.ts";
import { sunMoonRoutes } from "./routes/sunmoon.ts";
import { weatherLayerRoutes } from "./routes/weather-layers.ts";
import { windGridRoutes } from "./routes/wind-grid.ts";
import { tileRoutes } from "./routes/tiles.ts";
import { trafficRoutes } from "./routes/traffic.ts";
import { startAisStream } from "./sources/aisstream.ts";

export function build() {
  const app = Fastify({ logger: true });

  app.setErrorHandler((err: { statusCode?: number; message: string }, _req, reply) => {
    if (err instanceof BadRequest || err.statusCode === 400) {
      return reply.status(400).send({ error: err.message });
    }
    app.log.error(err);
    return reply.status(502).send({ error: "Veri kaynağına ulaşılamadı" });
  });

  app.get("/health", async () => ({ ok: true }));
  forecastRoutes(app);
  sunMoonRoutes(app);
  weatherLayerRoutes(app);
  windGridRoutes(app);
  tileRoutes(app);
  trafficRoutes(app);
  alertRoutes(app);

  return app;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const app = build();
  const port = Number(process.env.PORT ?? 3000);
  app
    .listen({ port, host: "0.0.0.0" })
    .then(() => {
      startAisStream((msg) => app.log.info(msg));
      startAlertJob((msg) => app.log.info(msg));
    })
    .catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
}
