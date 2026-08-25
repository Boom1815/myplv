import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppBindings } from "./env";
import { attachSession } from "./middleware/auth";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { prospectsRoutes } from "./routes/prospects";

const app = new Hono<AppBindings>();

app.use(
  "*",
  cors({
    origin: (origin, c) => origin ?? c.env.APP_URL,
    credentials: true,
  }),
);
app.use("*", attachSession);

app.route("/api/health", healthRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/prospects", prospectsRoutes);

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error", message: "Une erreur est survenue." }, 500);
});

export default app;
