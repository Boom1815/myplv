/**
 * Abstraction fournisseur d'email — brief section 37 : le reste de
 * l'application ne doit jamais dépendre directement de Brevo ou d'un
 * fournisseur en particulier.
 */
export type EmailMessage = {
  to: { email: string; name?: string };
  fromEmail: string;
  fromName: string;
  subject: string;
  htmlContent: string;
  replyTo?: string;
  /** Utilisé par certains fournisseurs pour le suivi/les statistiques — jamais pour du contenu. */
  tags?: string[];
};

export type EmailSendResult = { ok: true; providerMessageId: string } | { ok: false; error: string };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
