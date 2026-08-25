import { describe, expect, it } from "vitest";
import { computeScore } from "./engine";
import { evaluateCondition } from "./rules";
import { scoreToTier } from "./tier";
import type { ScoringInput, ScoringRuleDef } from "./types";

const NOW = new Date("2026-08-25T00:00:00Z");

function baseInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    startDate: null,
    collectedAt: NOW,
    sectorSlug: null,
    province: null,
    email: null,
    hasWebsite: null,
    enterpriseType: null,
    now: NOW,
    ...overrides,
  };
}

function rule(overrides: Partial<ScoringRuleDef>): ScoringRuleDef {
  return {
    id: "r1",
    slug: "test_rule",
    label: "Test",
    points: 10,
    isActive: true,
    condition: { kind: "no_website" },
    ...overrides,
  };
}

describe("scoreToTier", () => {
  it.each([
    [100, "tres_haute"],
    [80, "tres_haute"],
    [79, "haute"],
    [60, "haute"],
    [59, "moyenne"],
    [40, "moyenne"],
    [39, "faible"],
    [20, "faible"],
    [19, "ignorer"],
    [0, "ignorer"],
  ])("score %i -> %s", (score, tier) => {
    expect(scoreToTier(score as number)).toBe(tier);
  });
});

describe("evaluateCondition", () => {
  it("recent_company : dans la fenêtre -> true", () => {
    const input = baseInput({ startDate: "2026-08-01" }); // 24 jours avant NOW
    expect(evaluateCondition({ kind: "recent_company", params: { maxDaysAgo: 30 } }, input)).toBe(true);
  });

  it("recent_company : hors fenêtre -> false", () => {
    const input = baseInput({ startDate: "2026-01-01" });
    expect(evaluateCondition({ kind: "recent_company", params: { maxDaysAgo: 30 } }, input)).toBe(false);
  });

  it("recent_company : retombe sur collectedAt si pas de startDate", () => {
    const input = baseInput({ startDate: null, collectedAt: "2026-08-20" });
    expect(evaluateCondition({ kind: "recent_company", params: { maxDaysAgo: 10 } }, input)).toBe(true);
  });

  it("priority_sector : secteur dans la liste -> true", () => {
    const input = baseInput({ sectorSlug: "horeca" });
    expect(evaluateCondition({ kind: "priority_sector", params: { sectorSlugs: ["horeca", "construction"] } }, input)).toBe(
      true,
    );
  });

  it("priority_sector : secteur absent -> false", () => {
    const input = baseInput({ sectorSlug: "sante" });
    expect(evaluateCondition({ kind: "priority_sector", params: { sectorSlugs: ["horeca"] } }, input)).toBe(false);
  });

  it("priority_zone : province dans la liste -> true", () => {
    const input = baseInput({ province: "Hainaut" });
    expect(evaluateCondition({ kind: "priority_zone", params: { provinces: ["Hainaut", "Namur"] } }, input)).toBe(true);
  });

  it("valid_professional_email : email bien formé -> true", () => {
    expect(evaluateCondition({ kind: "valid_professional_email" }, baseInput({ email: "info@exemple.be" }))).toBe(true);
  });

  it("valid_professional_email : email malformé -> false", () => {
    expect(evaluateCondition({ kind: "valid_professional_email" }, baseInput({ email: "pas-un-email" }))).toBe(false);
  });

  it("valid_professional_email : absent -> false", () => {
    expect(evaluateCondition({ kind: "valid_professional_email" }, baseInput({ email: null }))).toBe(false);
  });

  it("no_website : hasWebsite = no -> true", () => {
    expect(evaluateCondition({ kind: "no_website" }, baseInput({ hasWebsite: "no" }))).toBe(true);
  });

  it("no_website : hasWebsite = yes -> false", () => {
    expect(evaluateCondition({ kind: "no_website" }, baseInput({ hasWebsite: "yes" }))).toBe(false);
  });

  it("weak_digital_presence : hasWebsite = unknown -> true", () => {
    expect(evaluateCondition({ kind: "weak_digital_presence" }, baseInput({ hasWebsite: "unknown" }))).toBe(true);
  });

  it("weak_digital_presence : hasWebsite = yes -> false", () => {
    expect(evaluateCondition({ kind: "weak_digital_presence" }, baseInput({ hasWebsite: "yes" }))).toBe(false);
  });

  it("independent : type 1 (personne physique) -> true", () => {
    expect(evaluateCondition({ kind: "independent" }, baseInput({ enterpriseType: "1" }))).toBe(true);
  });

  it("independent : type 2 (personne morale) -> false", () => {
    expect(evaluateCondition({ kind: "independent" }, baseInput({ enterpriseType: "2" }))).toBe(false);
  });
});

describe("computeScore", () => {
  it("additionne les points des règles actives qui matchent", () => {
    const rules: ScoringRuleDef[] = [
      rule({ slug: "a", points: 20, condition: { kind: "recent_company", params: { maxDaysAgo: 30 } } }),
      rule({ slug: "b", points: 15, condition: { kind: "priority_sector", params: { sectorSlugs: ["horeca"] } } }),
      rule({ slug: "c", points: 10, condition: { kind: "priority_zone", params: { provinces: ["Namur"] } } }),
    ];
    const input = baseInput({ startDate: "2026-08-10", sectorSlug: "horeca", province: "Namur" });

    const result = computeScore(rules, input);

    expect(result.score).toBe(45);
    expect(result.tier).toBe("moyenne");
    expect(result.breakdown).toHaveLength(3);
    expect(result.breakdown.every((b) => b.matched)).toBe(true);
  });

  it("ignore les règles inactives", () => {
    const rules: ScoringRuleDef[] = [
      rule({ slug: "a", points: 50, isActive: false, condition: { kind: "no_website" } }),
    ];
    const result = computeScore(rules, baseInput({ hasWebsite: "no" }));
    expect(result.score).toBe(0);
    expect(result.breakdown).toHaveLength(0);
  });

  it("borne le score à 100 même si les règles actives qui matchent dépassent ce total", () => {
    const rules: ScoringRuleDef[] = [
      rule({ slug: "a", points: 60, condition: { kind: "no_website" } }),
      rule({ slug: "b", points: 60, condition: { kind: "independent" } }),
    ];
    const result = computeScore(rules, baseInput({ hasWebsite: "no", enterpriseType: "1" }));
    // Les deux règles matchent (120 points bruts) mais le score reste borné à 100.
    expect(result.score).toBe(100);
    expect(result.tier).toBe("tres_haute");
  });

  it("ne descend jamais sous 0 avec des règles à points négatifs", () => {
    const rules: ScoringRuleDef[] = [rule({ slug: "malus", points: -30, condition: { kind: "no_website" } })];
    const result = computeScore(rules, baseInput({ hasWebsite: "no" }));
    expect(result.score).toBe(0);
    expect(result.tier).toBe("ignorer");
  });
});
