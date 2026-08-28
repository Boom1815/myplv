import { Hono } from "hono";
import { schema } from "@myplv/db";
import { and, count, desc, eq, gte, inArray, isNotNull, type SQL } from "drizzle-orm";
import {
  appendUnsubscribeFooter,
  createEmailProvider,
  generateUnsubscribeToken,
  renderTemplate,
  SAMPLE_VARIABLES,
  SIGNATURE_SETTINGS_KEY,
  type TemplateVariables,
} from "@myplv/email";
import type { AppBindings } from "../env";
import { createDbForEnv } from "../db";
import { requireAuth, requireAdmin } from "../middleware/auth";

export const campaignsRoutes = new Hono<AppBindings>();

campaignsRoutes.use("*", requireAuth);

/** Signature email globale (voir routes/signature.ts) — ajoutée entre le corps du template et le pied de page de désinscription, sur CHAQUE envoi. Chaîne vide si jamais configurée : aucun changement au comportement existant. */
async function getSignatureBodyHtml(db: ReturnType<typeof createDbForEnv>): Promise<string> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, SIGNATURE_SETTINGS_KEY));
  const value = row?.value;
  return value && typeof value === "object" && typeof (value as { bodyHtml?: unknown }).bodyHtml === "string"
    ? (value as { bodyHtml: string }).bodyHtml
    : "";
}

/** Filtres d'audience supportés — cases à cocher combinées en ET entre catégories, OU à l'intérieur d'une même catégorie (ex. Hainaut OU Namur, ET secteur Horeca). Une catégorie vide = pas de restriction sur ce critère. */
type SegmentFilter = {
  provinces?: string[];
  sectorIds?: string[];
  scoreTiers?: string[];
};

function asNonEmptyStringArray(v: unknown): string[] | undefined {
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" && x) ? (v as string[]) : undefined;
}

function sanitizeSegmentFilter(raw: unknown): SegmentFilter {
  if (!raw || typeof raw !== "object") return {};
  const { provinces, sectorIds, scoreTiers } = raw as SegmentFilter;
  return {
    provinces: asNonEmptyStringArray(provinces),
    sectorIds: asNonEmptyStringArray(sectorIds),
    scoreTiers: asNonEmptyStringArray(scoreTiers),
  };
}

function parseSegmentFilter(value: string | null): SegmentFilter {
  if (!value) return {};
  try {
    return sanitizeSegmentFilter(JSON.parse(value));
  } catch {
    return {};
  }
}

function segmentConditions(filter: SegmentFilter): SQL[] {
  const conditions: SQL[] = [
    eq(schema.prospects.isEligibleForEmail, "true"),
    isNotNull(schema.companies.email),
  ];
  if (filter.provinces?.length) conditions.push(inArray(schema.companies.province, filter.provinces));
  if (filter.sectorIds?.length) conditions.push(inArray(schema.companies.sectorId, filter.sectorIds));
  if (filter.scoreTiers?.length) {
    conditions.push(
      inArray(schema.prospects.scoreTier, filter.scoreTiers as (typeof schema.scoreTier.enumValues)[number][]),
    );
  }
  return conditions;
}

/** GET /api/campaigns — liste, avec offre et nombre d'étapes. */
campaignsRoutes.get("/", async (c) => {
  const db = createDbForEnv(c.env);
  const rows = await db
    .select({
      id: schema.campaigns.id,
      name: schema.campaigns.name,
      mode: schema.campaigns.mode,
      status: schema.campaigns.status,
      segmentFilter: schema.campaigns.segmentFilter,
      dailySendLimit: schema.campaigns.dailySendLimit,
      offerId: schema.campaigns.offerId,
      offerName: schema.offers.name,
      createdAt: schema.campaigns.createdAt,
      updatedAt: schema.campaigns.updatedAt,
    })
    .from(schema.campaigns)
    .leftJoin(schema.offers, eq(schema.offers.id, schema.campaigns.offerId))
    .orderBy(desc(schema.campaigns.createdAt));

  const stepCounts = await db
    .select({ campaignId: schema.campaignSteps.campaignId, n: count() })
    .from(schema.campaignSteps)
    .groupBy(schema.campaignSteps.campaignId);
  const stepCountByCampaign = new Map(stepCounts.map((r) => [r.campaignId, r.n]));

  return c.json({
    data: rows.map((r) => ({ ...r, segmentFilter: parseSegmentFilter(r.segmentFilter), stepCount: stepCountByCampaign.get(r.id) ?? 0 })),
  });
});

/** POST /api/campaigns — ADMIN. Toute campagne démarre en dry_run (brief section 49). */
campaignsRoutes.post("/", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const body = await c.req
    .json<{ name?: string; offerId?: string; segmentFilter?: SegmentFilter; dailySendLimit?: number }>()
    .catch(() => ({}) as { name?: string; offerId?: string; segmentFilter?: SegmentFilter; dailySendLimit?: number });

  const name = body.name?.trim();
  if (!name) return c.json({ error: "invalid_request", message: "Le nom de la campagne est requis." }, 400);

  const dailySendLimit = Number.isFinite(body.dailySendLimit) && (body.dailySendLimit ?? 0) > 0 ? Math.trunc(body.dailySendLimit!) : 50;

  const [created] = await db
    .insert(schema.campaigns)
    .values({
      name,
      offerId: body.offerId || null,
      segmentFilter: JSON.stringify(sanitizeSegmentFilter(body.segmentFilter)),
      dailySendLimit,
    })
    .returning();

  await db.insert(schema.auditLogs).values({
    userId: c.get("userId")!,
    action: "campaign.create",
    entityType: "campaign",
    entityId: created.id,
    metadata: { name },
  });

  return c.json({ campaign: { ...created, segmentFilter: parseSegmentFilter(created.segmentFilter) } }, 201);
});

/** GET /api/campaigns/:id — détail avec étapes (template joint) et offre. */
campaignsRoutes.get("/:id", async (c) => {
  const db = createDbForEnv(c.env);
  const id = c.req.param("id");

  const [campaign] = await db
    .select({
      id: schema.campaigns.id,
      name: schema.campaigns.name,
      mode: schema.campaigns.mode,
      status: schema.campaigns.status,
      segmentFilter: schema.campaigns.segmentFilter,
      dailySendLimit: schema.campaigns.dailySendLimit,
      offerId: schema.campaigns.offerId,
      offerName: schema.offers.name,
      landingUrl: schema.offers.landingUrl,
      createdAt: schema.campaigns.createdAt,
      updatedAt: schema.campaigns.updatedAt,
    })
    .from(schema.campaigns)
    .leftJoin(schema.offers, eq(schema.offers.id, schema.campaigns.offerId))
    .where(eq(schema.campaigns.id, id));
  if (!campaign) return c.json({ error: "not_found" }, 404);

  const steps = await db
    .select({
      id: schema.campaignSteps.id,
      stepOrder: schema.campaignSteps.stepOrder,
      delayDays: schema.campaignSteps.delayDays,
      stopOnReply: schema.campaignSteps.stopOnReply,
      emailTemplateId: schema.campaignSteps.emailTemplateId,
      templateName: schema.emailTemplates.name,
      templateSubject: schema.emailTemplates.subject,
    })
    .from(schema.campaignSteps)
    .leftJoin(schema.emailTemplates, eq(schema.emailTemplates.id, schema.campaignSteps.emailTemplateId))
    .where(eq(schema.campaignSteps.campaignId, id))
    .orderBy(schema.campaignSteps.stepOrder);

  const sentByStep = await db
    .select({ campaignStepId: schema.emailSends.campaignStepId, n: count() })
    .from(schema.emailSends)
    .where(and(eq(schema.emailSends.campaignId, id), eq(schema.emailSends.status, "sent")))
    .groupBy(schema.emailSends.campaignStepId);
  const sentCountByStep = new Map(sentByStep.map((r) => [r.campaignStepId, r.n]));

  return c.json({
    campaign: { ...campaign, segmentFilter: parseSegmentFilter(campaign.segmentFilter) },
    steps: steps.map((s) => ({ ...s, sentCount: sentCountByStep.get(s.id) ?? 0 })),
  });
});

/** PATCH /api/campaigns/:id — ADMIN. */
campaignsRoutes.patch("/:id", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const id = c.req.param("id");
  const body = await c.req
    .json<{
      name?: string;
      offerId?: string | null;
      segmentFilter?: SegmentFilter;
      dailySendLimit?: number;
      mode?: "dry_run" | "production";
      status?: "draft" | "scheduled" | "running" | "paused" | "completed";
    }>()
    .catch(() => ({}) as Record<string, never>);

  const patch: Record<string, unknown> = {};
  if (body.name?.trim()) patch.name = body.name.trim();
  if ("offerId" in body) patch.offerId = body.offerId || null;
  if (body.segmentFilter) patch.segmentFilter = JSON.stringify(sanitizeSegmentFilter(body.segmentFilter));
  if (Number.isFinite(body.dailySendLimit) && (body.dailySendLimit ?? 0) > 0) patch.dailySendLimit = Math.trunc(body.dailySendLimit!);
  if (body.mode === "dry_run" || body.mode === "production") patch.mode = body.mode;
  if (body.status && ["draft", "scheduled", "running", "paused", "completed"].includes(body.status)) patch.status = body.status;

  if (Object.keys(patch).length === 0) return c.json({ error: "invalid_request", message: "Rien à modifier." }, 400);

  const [updated] = await db
    .update(schema.campaigns)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.campaigns.id, id))
    .returning();
  if (!updated) return c.json({ error: "not_found" }, 404);

  await db.insert(schema.auditLogs).values({
    userId: c.get("userId")!,
    action: "campaign.update",
    entityType: "campaign",
    entityId: id,
    metadata: patch,
  });

  return c.json({ campaign: { ...updated, segmentFilter: parseSegmentFilter(updated.segmentFilter) } });
});

campaignsRoutes.delete("/:id", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const [deleted] = await db.delete(schema.campaigns).where(eq(schema.campaigns.id, c.req.param("id"))).returning();
  if (!deleted) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

/** GET /api/campaigns/:id/audience — taille du segment ciblé, avec échantillon. */
campaignsRoutes.get("/:id/audience", async (c) => {
  const db = createDbForEnv(c.env);
  const id = c.req.param("id");
  const [campaign] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, id));
  if (!campaign) return c.json({ error: "not_found" }, 404);

  const filter = parseSegmentFilter(campaign.segmentFilter);
  const where = and(...segmentConditions(filter));

  const [{ n: total }] = await db
    .select({ n: count() })
    .from(schema.prospects)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.prospects.companyId))
    .where(where);

  const sample = await db
    .select({
      companyName: schema.companies.name,
      email: schema.companies.email,
      province: schema.companies.province,
      scoreTier: schema.prospects.scoreTier,
    })
    .from(schema.prospects)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.prospects.companyId))
    .where(where)
    .orderBy(desc(schema.prospects.score))
    .limit(5);

  return c.json({ total, sample });
});

/** POST /api/campaigns/:id/steps — ADMIN. */
campaignsRoutes.post("/:id/steps", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const campaignId = c.req.param("id");
  const [campaign] = await db.select({ id: schema.campaigns.id }).from(schema.campaigns).where(eq(schema.campaigns.id, campaignId));
  if (!campaign) return c.json({ error: "not_found" }, 404);

  const body = await c.req
    .json<{ delayDays?: number; emailTemplateId?: string; stopOnReply?: boolean }>()
    .catch(() => ({}) as { delayDays?: number; emailTemplateId?: string; stopOnReply?: boolean });

  if (!body.emailTemplateId) return c.json({ error: "invalid_request", message: "Un template est requis." }, 400);

  const [{ n: existing }] = await db.select({ n: count() }).from(schema.campaignSteps).where(eq(schema.campaignSteps.campaignId, campaignId));

  const [created] = await db
    .insert(schema.campaignSteps)
    .values({
      campaignId,
      stepOrder: existing,
      delayDays: Number.isFinite(body.delayDays) ? Math.max(0, Math.trunc(body.delayDays!)) : 0,
      emailTemplateId: body.emailTemplateId,
      stopOnReply: body.stopOnReply === false ? "false" : "true",
    })
    .returning();

  return c.json({ step: created }, 201);
});

campaignsRoutes.patch("/:id/steps/:stepId", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const body = await c.req
    .json<{ delayDays?: number; emailTemplateId?: string; stopOnReply?: boolean }>()
    .catch(() => ({}) as { delayDays?: number; emailTemplateId?: string; stopOnReply?: boolean });

  const patch: Record<string, unknown> = {};
  if (Number.isFinite(body.delayDays)) patch.delayDays = Math.max(0, Math.trunc(body.delayDays!));
  if (body.emailTemplateId) patch.emailTemplateId = body.emailTemplateId;
  if (typeof body.stopOnReply === "boolean") patch.stopOnReply = body.stopOnReply ? "true" : "false";
  if (Object.keys(patch).length === 0) return c.json({ error: "invalid_request", message: "Rien à modifier." }, 400);

  const [updated] = await db
    .update(schema.campaignSteps)
    .set(patch)
    .where(and(eq(schema.campaignSteps.id, c.req.param("stepId")), eq(schema.campaignSteps.campaignId, c.req.param("id"))))
    .returning();
  if (!updated) return c.json({ error: "not_found" }, 404);
  return c.json({ step: updated });
});

campaignsRoutes.delete("/:id/steps/:stepId", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const [deleted] = await db
    .delete(schema.campaignSteps)
    .where(and(eq(schema.campaignSteps.id, c.req.param("stepId")), eq(schema.campaignSteps.campaignId, c.req.param("id"))))
    .returning();
  if (!deleted) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

/**
 * POST /api/campaigns/:id/steps/:stepId/send — ADMIN. Cœur de l'envoi.
 *
 * Sans `confirm: true` dans le corps (ou si la campagne est en dry_run) :
 * calcule et renvoie l'aperçu (audience éligible, nombre qui serait
 * envoyé, exemples rendus) SANS toucher à la base ni au fournisseur — brief
 * section 49/50 ("un bug ne doit jamais provoquer un envoi massif").
 *
 * Avec `confirm: true` ET mode "production" : envoie réellement, plafonné
 * par `dailySendLimit` de la campagne ET par la limite globale
 * `EMAIL_DAILY_LIMIT`, en tenant compte de ce qui a déjà été envoyé
 * aujourd'hui (tous secteurs confondus).
 */
campaignsRoutes.post("/:id/steps/:stepId/send", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const campaignId = c.req.param("id");
  const stepId = c.req.param("stepId");
  const body = await c.req.json<{ confirm?: boolean }>().catch(() => ({}) as { confirm?: boolean });

  const [campaign] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, campaignId));
  if (!campaign) return c.json({ error: "not_found" }, 404);

  const [step] = await db
    .select()
    .from(schema.campaignSteps)
    .where(and(eq(schema.campaignSteps.id, stepId), eq(schema.campaignSteps.campaignId, campaignId)));
  if (!step) return c.json({ error: "not_found" }, 404);
  if (!step.emailTemplateId) return c.json({ error: "invalid_request", message: "Cette étape n'a pas de template." }, 400);

  const [template] = await db.select().from(schema.emailTemplates).where(eq(schema.emailTemplates.id, step.emailTemplateId));
  if (!template) return c.json({ error: "invalid_request", message: "Template introuvable." }, 400);

  const signatureBodyHtml = await getSignatureBodyHtml(db);

  const offer = campaign.offerId ? (await db.select().from(schema.offers).where(eq(schema.offers.id, campaign.offerId)))[0] : undefined;

  const filter = parseSegmentFilter(campaign.segmentFilter);
  const alreadySent = await db
    .select({ prospectId: schema.emailSends.prospectId })
    .from(schema.emailSends)
    .where(and(eq(schema.emailSends.campaignStepId, stepId), inArray(schema.emailSends.status, ["sent", "scheduled"])));
  const alreadySentIds = new Set(alreadySent.map((r) => r.prospectId));

  const candidates = await db
    .select({
      prospectId: schema.prospects.id,
      companyId: schema.companies.id,
      companyName: schema.companies.name,
      email: schema.companies.email,
      province: schema.companies.province,
      municipality: schema.companies.municipality,
      sectorId: schema.companies.sectorId,
    })
    .from(schema.prospects)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.prospects.companyId))
    .where(and(...segmentConditions(filter)));

  const emails = candidates.map((r) => r.email).filter((e): e is string => !!e);
  const suppressed = emails.length
    ? new Set(
        (await db.select({ email: schema.suppressionList.email }).from(schema.suppressionList).where(inArray(schema.suppressionList.email, emails))).map(
          (s) => s.email,
        ),
      )
    : new Set<string>();

  const eligible = candidates.filter((p) => p.email && !alreadySentIds.has(p.prospectId) && !suppressed.has(p.email));

  const sectorIds = [...new Set(eligible.map((p) => p.sectorId).filter((s): s is string => !!s))];
  const sectorLabelById = new Map(
    sectorIds.length ? (await db.select({ id: schema.sectors.id, label: schema.sectors.label }).from(schema.sectors).where(inArray(schema.sectors.id, sectorIds))).map((s) => [s.id, s.label]) : [],
  );

  const companyIds = eligible.map((p) => p.companyId);
  const contactByCompany = new Map<string, { firstName: string | null; lastName: string | null }>();
  if (companyIds.length) {
    const contactRows = await db
      .select({ companyId: schema.contacts.companyId, firstName: schema.contacts.firstName, lastName: schema.contacts.lastName })
      .from(schema.contacts)
      .where(inArray(schema.contacts.companyId, companyIds));
    for (const row of contactRows) {
      if (!contactByCompany.has(row.companyId)) contactByCompany.set(row.companyId, row);
    }
  }

  const apiOrigin = new URL(c.req.url).origin;

  function buildVariables(p: (typeof eligible)[number]): TemplateVariables {
    const contact = contactByCompany.get(p.companyId);
    return {
      prenom: contact?.firstName ?? "",
      nom: contact?.lastName ?? "",
      entreprise: p.companyName,
      secteur: p.sectorId ? (sectorLabelById.get(p.sectorId) ?? "") : "",
      commune: p.municipality ?? "",
      province: p.province ?? "",
      offre: offer?.name ?? "",
      lien: offer?.landingUrl ?? "",
    };
  }

  // Limite globale, tous envois de la journée confondus (brief section 16/49).
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const [{ n: sentToday }] = await db
    .select({ n: count() })
    .from(schema.emailSends)
    .where(and(eq(schema.emailSends.status, "sent"), gte(schema.emailSends.sentAt, startOfToday)));
  const globalLimit = Number(c.env.EMAIL_DAILY_LIMIT || "50");
  const globalRemaining = Math.max(0, globalLimit - sentToday);
  const willSend = Math.min(eligible.length, campaign.dailySendLimit, globalRemaining);

  const previewSample = eligible.slice(0, 3).map((p) => {
    const vars = buildVariables(p);
    return {
      companyName: p.companyName,
      email: p.email,
      subject: renderTemplate(template.subject, vars),
      bodyHtml: renderTemplate(template.bodyHtml, vars),
    };
  });

  const shouldSend = campaign.mode === "production" && body.confirm === true;

  if (!shouldSend) {
    return c.json({
      dryRun: true,
      reason: campaign.mode === "dry_run" ? "dry_run" : "confirmation_required",
      eligibleCount: eligible.length,
      willSend,
      dailySendLimit: campaign.dailySendLimit,
      globalDailyLimit: globalLimit,
      globalRemainingToday: globalRemaining,
      preview: previewSample,
    });
  }

  const provider = createEmailProvider(c.env);
  const toSend = eligible.slice(0, willSend);
  let sent = 0;
  let failed = 0;

  for (const p of toSend) {
    const vars = buildVariables(p);
    const token = await generateUnsubscribeToken(p.email!, c.env.AUTH_SECRET);
    const unsubscribeUrl = `${apiOrigin}/api/unsubscribe?email=${encodeURIComponent(p.email!)}&token=${token}`;
    const subject = renderTemplate(template.subject, vars);
    const bodyWithSignature = renderTemplate(template.bodyHtml, vars) + renderTemplate(signatureBodyHtml, vars);
    const htmlContent = appendUnsubscribeFooter(bodyWithSignature, unsubscribeUrl);

    const result = await provider.send({
      to: { email: p.email!, name: p.companyName },
      fromEmail: c.env.EMAIL_FROM_ADDRESS || "no-reply@myplv.be",
      fromName: c.env.EMAIL_FROM_NAME || "MYPLV",
      subject,
      htmlContent,
      tags: ["campaign:" + campaignId, "step:" + stepId],
    });

    if (result.ok) {
      sent++;
      await db.insert(schema.emailSends).values({
        campaignId,
        campaignStepId: stepId,
        prospectId: p.prospectId,
        emailTemplateId: template.id,
        toEmail: p.email!,
        status: "sent",
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
      });
    } else {
      failed++;
      await db.insert(schema.emailSends).values({
        campaignId,
        campaignStepId: stepId,
        prospectId: p.prospectId,
        emailTemplateId: template.id,
        toEmail: p.email!,
        status: "failed",
        errorMessage: result.error,
      });
    }
  }

  if (campaign.status === "draft" || campaign.status === "scheduled") {
    await db.update(schema.campaigns).set({ status: "running", updatedAt: new Date() }).where(eq(schema.campaigns.id, campaignId));
  }

  await db.insert(schema.auditLogs).values({
    userId: c.get("userId")!,
    action: "campaign.send",
    entityType: "campaign_step",
    entityId: stepId,
    metadata: { campaignId, attempted: toSend.length, sent, failed, provider: provider.name },
  });

  return c.json({
    dryRun: false,
    attempted: toSend.length,
    sent,
    failed,
    remainingEligible: eligible.length - toSend.length,
  });
});

/**
 * POST /api/campaigns/:id/steps/:stepId/test — ADMIN. Envoie UN email de
 * test à une adresse choisie (ex. la tienne), avec des données d'exemple —
 * jamais un vrai prospect. Indépendant du mode dry_run/production et des
 * plafonds d'envoi (un seul destinataire, pas d'impact sur l'audience réelle) ;
 * n'écrit pas dans email_sends (ne compte pas comme un envoi de campagne).
 */
campaignsRoutes.post("/:id/steps/:stepId/test", requireAdmin, async (c) => {
  const db = createDbForEnv(c.env);
  const campaignId = c.req.param("id");
  const stepId = c.req.param("stepId");
  const body = await c.req.json<{ to?: string }>().catch(() => ({}) as { to?: string });
  const to = body.to?.trim();
  if (!to) return c.json({ error: "invalid_request", message: "Adresse email de test requise." }, 400);

  const [campaign] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, campaignId));
  if (!campaign) return c.json({ error: "not_found" }, 404);

  const [step] = await db
    .select()
    .from(schema.campaignSteps)
    .where(and(eq(schema.campaignSteps.id, stepId), eq(schema.campaignSteps.campaignId, campaignId)));
  if (!step || !step.emailTemplateId) return c.json({ error: "invalid_request", message: "Étape ou template introuvable." }, 400);

  const [template] = await db.select().from(schema.emailTemplates).where(eq(schema.emailTemplates.id, step.emailTemplateId));
  if (!template) return c.json({ error: "invalid_request", message: "Template introuvable." }, 400);

  const signatureBodyHtml = await getSignatureBodyHtml(db);

  const offer = campaign.offerId ? (await db.select().from(schema.offers).where(eq(schema.offers.id, campaign.offerId)))[0] : undefined;
  const vars: TemplateVariables = { ...SAMPLE_VARIABLES, offre: offer?.name ?? SAMPLE_VARIABLES.offre, lien: offer?.landingUrl ?? SAMPLE_VARIABLES.lien };

  const apiOrigin = new URL(c.req.url).origin;
  const token = await generateUnsubscribeToken(to, c.env.AUTH_SECRET);
  const unsubscribeUrl = `${apiOrigin}/api/unsubscribe?email=${encodeURIComponent(to)}&token=${token}`;
  const subject = `[TEST] ${renderTemplate(template.subject, vars)}`;
  const bodyWithSignature = renderTemplate(template.bodyHtml, vars) + renderTemplate(signatureBodyHtml, vars);
  const htmlContent = appendUnsubscribeFooter(bodyWithSignature, unsubscribeUrl);

  const provider = createEmailProvider(c.env);
  const result = await provider.send({
    to: { email: to },
    fromEmail: c.env.EMAIL_FROM_ADDRESS || "no-reply@myplv.be",
    fromName: c.env.EMAIL_FROM_NAME || "MYPLV",
    subject,
    htmlContent,
    tags: ["test", "campaign:" + campaignId, "step:" + stepId],
  });

  await db.insert(schema.auditLogs).values({
    userId: c.get("userId")!,
    action: "campaign.test_send",
    entityType: "campaign_step",
    entityId: stepId,
    metadata: { to, ok: result.ok, provider: provider.name },
  });

  if (!result.ok) return c.json({ ok: false, error: result.error, provider: provider.name }, 502);
  return c.json({ ok: true, provider: provider.name });
});
