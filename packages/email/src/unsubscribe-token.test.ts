import { describe, expect, it } from "vitest";
import { generateUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe-token";

describe("unsubscribe-token", () => {
  it("génère un jeton vérifiable pour la même adresse et le même secret", async () => {
    const token = await generateUnsubscribeToken("info@myplv.be", "secret-1");
    expect(await verifyUnsubscribeToken("info@myplv.be", token, "secret-1")).toBe(true);
  });

  it("est insensible à la casse et aux espaces de l'adresse", async () => {
    const token = await generateUnsubscribeToken("info@myplv.be", "secret-1");
    expect(await verifyUnsubscribeToken("  Info@MyPLV.be  ", token, "secret-1")).toBe(true);
  });

  it("rejette un jeton généré avec un autre secret", async () => {
    const token = await generateUnsubscribeToken("info@myplv.be", "secret-1");
    expect(await verifyUnsubscribeToken("info@myplv.be", token, "secret-2")).toBe(false);
  });

  it("rejette un jeton généré pour une autre adresse", async () => {
    const token = await generateUnsubscribeToken("info@myplv.be", "secret-1");
    expect(await verifyUnsubscribeToken("autre@myplv.be", token, "secret-1")).toBe(false);
  });

  it("rejette un jeton altéré", async () => {
    const token = await generateUnsubscribeToken("info@myplv.be", "secret-1");
    const tampered = token.slice(0, -1) + (token.at(-1) === "a" ? "b" : "a");
    expect(await verifyUnsubscribeToken("info@myplv.be", tampered, "secret-1")).toBe(false);
  });
});
