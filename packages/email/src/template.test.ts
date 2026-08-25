import { describe, expect, it } from "vitest";
import { renderTemplate, findUnknownVariables } from "./template";

describe("renderTemplate", () => {
  it("remplace les variables connues", () => {
    const out = renderTemplate("Bonjour {{prenom}}, chez {{entreprise}} !", {
      prenom: "Marie",
      entreprise: "Boulangerie du Coin",
    });
    expect(out).toBe("Bonjour Marie, chez Boulangerie du Coin !");
  });

  it("remplace une variable manquante par une chaîne vide, jamais 'undefined'", () => {
    const out = renderTemplate("Bonjour {{prenom}} {{nom}}", { prenom: "Marie" });
    expect(out).toBe("Bonjour Marie ");
    expect(out).not.toContain("undefined");
  });

  it("tolère les espaces à l'intérieur des accolades", () => {
    const out = renderTemplate("{{ prenom }}", { prenom: "Marie" });
    expect(out).toBe("Marie");
  });

  it("laisse le texte sans variable inchangé", () => {
    expect(renderTemplate("Aucune variable ici.", {})).toBe("Aucune variable ici.");
  });
});

describe("findUnknownVariables", () => {
  it("détecte les variables non reconnues", () => {
    const known = ["prenom", "nom"];
    expect(findUnknownVariables("{{prenom}} {{typo_var}}", known)).toEqual(["typo_var"]);
  });

  it("retourne un tableau vide si tout est connu", () => {
    expect(findUnknownVariables("{{prenom}} {{nom}}", ["prenom", "nom"])).toEqual([]);
  });
});
