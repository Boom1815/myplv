/** Bindings d'environnement disponibles à l'exécution (Workers `env`, ou process.env en local). */
export type Env = {
  DATABASE_URL: string;
  /** "node-postgres" en dev local uniquement — voir db.ts. Absent en production (Workers). */
  DB_DRIVER?: string;
  AUTH_SECRET: string;
  APP_URL: string;
  SESSION_COOKIE_NAME: string;
  SESSION_TTL_HOURS: string;
  /** "Lax" (défaut, production même domaine) | "None" (aperçu multi-domaines — voir routes/auth.ts). */
  SESSION_COOKIE_SAMESITE?: string;
  EMAIL_PROVIDER?: string;
  BREVO_API_KEY?: string;
  EMAIL_FROM_ADDRESS?: string;
  EMAIL_FROM_NAME?: string;
  EMAIL_DAILY_LIMIT?: string;
  CRON_SECRET?: string;
};

export type AppBindings = {
  Bindings: Env;
  Variables: {
    userId?: string;
    userRole?: "admin" | "reader";
    userEmail?: string;
  };
};
