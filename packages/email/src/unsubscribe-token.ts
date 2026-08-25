/**
 * Jeton de désinscription sans état — brief section 41. Dérivé par HMAC de
 * l'adresse email et d'un secret serveur : pas besoin de colonne dédiée en
 * base, pas de token à générer/stocker à l'envoi, vérifiable à la volée.
 */
function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, value: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
}

export async function generateUnsubscribeToken(email: string, secret: string): Promise<string> {
  const digest = await hmac(secret, email.trim().toLowerCase());
  return toBase64Url(digest).slice(0, 24);
}

export async function verifyUnsubscribeToken(email: string, token: string, secret: string): Promise<boolean> {
  const expected = await generateUnsubscribeToken(email, secret);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
