import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppBindings } from "./env";
import { attachSession } from "./middleware/auth";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { prospectsRoutes } from "./routes/prospects";
import { scoringRoutes } from "./routes/scoring";
import { dashboardRoutes } from "./routes/dashboard";
import { blacklistRoutes } from "./routes/blacklist";
import { sectorsRoutes } from "./routes/sectors";
import { geoZonesRoutes } from "./routes/geographic-zones";
import { tagsRoutes } from "./routes/tags";
import { offersRoutes } from "./routes/offers";
import { emailTemplatesRoutes } from "./routes/email-templates";
import { unsubscribeRoutes } from "./routes/unsubscribe";

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
app.route("/api/scoring-rules", scoringRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/blacklist", blacklistRoutes);
app.route("/api/sectors", sectorsRoutes);
app.route("/api/geographic-zones", geoZonesRoutes);
app.route("/api/tags", tagsRoutes);
app.route("/api/offers", offersRoutes);
app.route("/api/email-templates", emailTemplatesRoutes);
app.route("/api/unsubscribe", unsubscribeRoutes);

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((err, c) => {
  console.error(err);
  // Diagnostic temporaire (aucun trafic réel encore) : renvoie l'erreur
  // exacte au lieu de la masquer, le temps de finir la mise en route en
  // production. À revenir au message générique une fois le login validé.
  return c.json(
    {
      error: "internal_error",
      message: "Une erreur est survenue.",
      debug: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
    },
    500,
  );
});

export default app;
