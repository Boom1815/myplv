import { describe, expect, it, vi, afterEach } from "vitest";
import { DryRunProvider } from "./providers/dry-run";
import { BrevoProvider } from "./providers/brevo";
import { createEmailProvider } from "./factory";

const SAMPLE_MESSAGE = {
  to: { email: "prospect@exemple.be", name: "Prospect Test" },
  fromEmail: "campagnes@myplv.be",
  fromName: "MYPLV",
  subject: "Test",
  htmlContent: "<p>Bonjour</p>",
};

describe("DryRunProvider", () => {
  it("ne fait aucun appel réseau et retourne un id factice", async () => {
    const logged: unknown[] = [];
    const provider = new DryRunProvider((m) => logged.push(m));
    const result = await provider.send(SAMPLE_MESSAGE);

    expect(result.ok).toBe(true);
    expect(logged).toHaveLength(1);
    if (result.ok) expect(result.providerMessageId).toMatch(/^dryrun_/);
  });
});

describe("BrevoProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envoie la requête attendue à l'API Brevo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: "brevo-123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new BrevoProvider("test-api-key");
    const result = await provider.send(SAMPLE_MESSAGE);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(options.headers["api-key"]).toBe("test-api-key");

    const body = JSON.parse(options.body);
    expect(body.to).toEqual([{ email: "prospect@exemple.be", name: "Prospect Test" }]);
    expect(body.sender).toEqual({ email: "campagnes@myplv.be", name: "MYPLV" });

    expect(result).toEqual({ ok: true, providerMessageId: "brevo-123" });
  });

  it("retourne une erreur explicite sur une réponse non-OK, sans lever d'exception", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"message":"Key not found"}',
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new BrevoProvider("bad-key");
    const result = await provider.send(SAMPLE_MESSAGE);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("401");
  });
});

describe("createEmailProvider", () => {
  it("retombe sur DryRunProvider par défaut (aucune config)", () => {
    expect(createEmailProvider({}).name).toBe("dry_run");
  });

  it("retombe sur DryRunProvider si la clé Brevo manque, même si EMAIL_PROVIDER=brevo", () => {
    expect(createEmailProvider({ EMAIL_PROVIDER: "brevo" }).name).toBe("dry_run");
  });

  it("utilise Brevo uniquement si explicitement configuré avec une clé", () => {
    expect(createEmailProvider({ EMAIL_PROVIDER: "brevo", BREVO_API_KEY: "k" }).name).toBe("brevo");
  });
});
