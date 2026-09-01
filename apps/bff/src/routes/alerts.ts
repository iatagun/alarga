import { randomUUID } from "node:crypto";
import type { AlertRegistration, AlertSubscription, BoatSize } from "@alarga/types";
import type { FastifyInstance } from "fastify";
import { BadRequest } from "../envelope.ts";
import { isExpoPushToken } from "../push.ts";
import {
  addSubscription,
  getSubscriptions,
  removeSubscription,
} from "../store.ts";

const BOATS: BoatSize[] = ["small", "medium", "large"];

export function alertRoutes(app: FastifyInstance): void {
  // Cihazın mevcut abonelikleri.
  app.get<{ Querystring: { deviceToken?: string } }>(
    "/alerts",
    async (req) => {
      const token = req.query.deviceToken;
      if (!token) throw new BadRequest("deviceToken zorunlu");
      return { subscriptions: getSubscriptions(token) };
    },
  );

  // Yeni bölge aboneliği.
  app.post<{ Body: AlertRegistration & { deviceToken?: string } }>(
    "/alerts",
    async (req, reply) => {
      const b = req.body ?? ({} as typeof req.body);
      if (!b.deviceToken || !isExpoPushToken(b.deviceToken)) {
        throw new BadRequest("geçerli bir deviceToken gerekli");
      }
      if (!Number.isFinite(b.lat) || !Number.isFinite(b.lon)) {
        throw new BadRequest("lat/lon zorunlu");
      }
      const boat: BoatSize = BOATS.includes(b.boat) ? b.boat : "small";

      // Aynı cihaz için tek abonelik — eskisini değiştir.
      for (const old of getSubscriptions(b.deviceToken)) {
        removeSubscription(old.id, b.deviceToken);
      }

      const sub: AlertSubscription = {
        id: randomUUID(),
        deviceId: b.deviceToken,
        lat: b.lat,
        lon: b.lon,
        boat: { size: boat },
        label: b.label?.trim() || "Balık bölgen",
        lastLevel: null,
        createdAt: new Date().toISOString(),
      };
      addSubscription(sub);
      return reply.status(201).send({ subscription: sub });
    },
  );

  app.delete<{ Params: { id: string }; Querystring: { deviceToken?: string } }>(
    "/alerts/:id",
    async (req, reply) => {
      const token = req.query.deviceToken;
      if (!token) throw new BadRequest("deviceToken zorunlu");
      const ok = removeSubscription(req.params.id, token);
      return reply.status(ok ? 204 : 404).send();
    },
  );
}
