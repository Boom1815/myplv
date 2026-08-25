import { Hono } from "hono";
import type { AppBindings } from "../env";

export const healthRoutes = new Hono<AppBindings>();

healthRoutes.get("/", (c) => c.json({ status: "ok", service: "myplv-api", time: new Date().toISOString() }));
