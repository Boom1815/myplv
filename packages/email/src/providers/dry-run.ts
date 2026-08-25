import type { EmailMessage, EmailProvider, EmailSendResult } from "../types";

/**
 * Fournisseur par défaut — n'envoie jamais réellement, journalise
 * seulement (brief section 49 : mode simulation). C'est le fournisseur
 * actif tant qu'aucune clé Brevo n'est configurée, et celui utilisé pour
 * toute campagne en mode `dry_run`.
 */
export class DryRunProvider implements EmailProvider {
  readonly name = "dry_run";
  private readonly log: (message: EmailMessage) => void;

  constructor(log: (message: EmailMessage) => void = (m) => console.log(`[dry-run] → ${m.to.email} : ${m.subject}`)) {
    this.log = log;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.log(message);
    return { ok: true, providerMessageId: `dryrun_${crypto.randomUUID()}` };
  }
}
