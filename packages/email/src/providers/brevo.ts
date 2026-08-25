import type { EmailMessage, EmailProvider, EmailSendResult } from "../types";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/**
 * Fournisseur Brevo (API transactionnelle) — brief section 35, plan
 * gratuit retenu dans le rapport d'audit (300 emails/jour). N'est utilisé
 * que pour les campagnes en mode `production` ; jamais en `dry_run`.
 */
export class BrevoProvider implements EmailProvider {
  readonly name = "brevo";
  constructor(private readonly apiKey: string) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": this.apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: message.fromEmail, name: message.fromName },
        to: [{ email: message.to.email, name: message.to.name }],
        subject: message.subject,
        htmlContent: message.htmlContent,
        ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
        ...(message.tags?.length ? { tags: message.tags } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Brevo ${res.status} : ${body.slice(0, 500)}` };
    }

    const data = (await res.json().catch(() => ({}))) as { messageId?: string };
    return { ok: true, providerMessageId: data.messageId ?? "unknown" };
  }
}
