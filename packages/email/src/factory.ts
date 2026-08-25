import type { EmailProvider } from "./types";
import { DryRunProvider } from "./providers/dry-run";
import { BrevoProvider } from "./providers/brevo";

/**
 * Choix du fournisseur. Le défaut est TOUJOURS `DryRunProvider` — une
 * config manquante ou mal renseignée ne doit jamais se traduire par un
 * envoi réel silencieux (brief section 38 : "un bug ne doit jamais
 * provoquer un envoi massif").
 */
export function createEmailProvider(env: { EMAIL_PROVIDER?: string; BREVO_API_KEY?: string }): EmailProvider {
  if (env.EMAIL_PROVIDER === "brevo" && env.BREVO_API_KEY) {
    return new BrevoProvider(env.BREVO_API_KEY);
  }
  return new DryRunProvider();
}
