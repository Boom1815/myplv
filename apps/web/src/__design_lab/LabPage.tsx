import { FeedbackOverlay } from "./FeedbackOverlay";
import { VariantA } from "./variants/VariantA";
import { VariantB } from "./variants/VariantB";
import { VariantC } from "./variants/VariantC";
import { VariantD } from "./variants/VariantD";
import { VariantE } from "./variants/VariantE";

const VARIANTS: { id: string; title: string; blurb: string; render: () => JSX.Element }[] = [
  { id: "A", title: "A — Hiérarchie", blurb: "Un seul chiffre héros (éligibles email), tout le reste redescend d'un cran. Couleur très retenue.", render: VariantA },
  { id: "B", title: "B — Mise en page", blurb: "Colonne \"en un coup d'œil\" à gauche avec badges colorés par KPI, anneau de répartition à droite.", render: VariantB },
  { id: "C", title: "C — Densité", blurb: "Plus compact que l'actuel : tout tient sans scroll, couleur en petites touches (points, mini-barres).", render: VariantC },
  { id: "D", title: "D — Interaction", blurb: "Chiffres qui comptent à l'affichage, barres qui poussent, bulle au survol, point \"live\" qui pulse.", render: VariantD },
  { id: "E", title: "E — Expressif", blurb: "Va le plus loin sur la palette de marque (orange/bleu/magenta) : halo dégradé, liserés colorés, élévation au survol.", render: VariantE },
];

export function LabPage() {
  return (
    <div style={{ minHeight: "100%", background: "#f0f1ee" }}>
      <div style={{ background: "#14151a", color: "#fff", padding: "22px 32px", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#b6b7bf", marginBottom: 6 }}>Design Lab — myPLV</div>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>5 pistes pour le Dashboard (représentatif du système partagé : topbar, cartes, badges)</h1>
          <p style={{ fontSize: 13, color: "#b6b7bf", margin: 0, maxWidth: 820, lineHeight: 1.5 }}>
            Palette imposée par le logo (orange / bleu / magenta), dosée — pas une interface "arc-en-ciel". Direction : clair, moderne, aligné,
            un peu animé. Clique <strong style={{ color: "#fff" }}>💬 Ajouter un feedback</strong> en bas à droite pour commenter n'importe quel
            élément de n'importe quelle variante, puis termine pour générer le rapport à coller dans la conversation.
          </p>
        </div>
      </div>

      <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 28, maxWidth: 1400, margin: "0 auto" }}>
        {VARIANTS.map((v) => (
          <div key={v.id} data-variant={v.id} style={{ background: "#fff", border: "1px solid #d8d9d4", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #e3e3df", display: "flex", alignItems: "baseline", gap: 14, fontFamily: "Arial, Helvetica, sans-serif" }}>
              <strong style={{ fontSize: 14 }}>{v.title}</strong>
              <span style={{ fontSize: 12.5, color: "#666" }}>{v.blurb}</span>
            </div>
            <div style={{ transform: "scale(1)", transformOrigin: "top left" }}>{v.render()}</div>
          </div>
        ))}
      </div>

      <FeedbackOverlay targetName="Dashboard / système de design myPLV" />
    </div>
  );
}
