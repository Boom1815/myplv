import { useEffect, useRef, useState } from "react";

/**
 * Design Lab — overlay de feedback façon Figma : active un mode "clic pour
 * commenter" sur n'importe quel élément de la page, puis génère un rapport
 * markdown groupé par variante à coller dans la conversation. Écrit en
 * styles inline uniquement (jamais de classes) pour ne jamais entrer en
 * conflit avec le CSS scoping de chaque variante. Fichier temporaire.
 */

type Comment = {
  id: string;
  variant: string;
  selector: string;
  description: string;
  text: string;
};

function describeElement(el: Element): { selector: string; description: string } {
  const tag = el.tagName.toLowerCase();
  const testId = el.getAttribute("data-testid");
  const id = el.id;
  let selector = testId ? `[data-testid='${testId}']` : id ? `#${id}` : tag;
  const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
  const description = text ? `${tag} avec "${text}${text.length === 40 ? "…" : ""}"` : tag;
  if (!testId && !id) {
    const cls = Array.from(el.classList).find((c) => !c.startsWith("mp-"));
    if (cls) selector = `${tag}.${cls}`;
  }
  return { selector, description };
}

function findVariantRoot(el: Element): string {
  let node: Element | null = el;
  while (node) {
    const v = node.getAttribute("data-variant");
    if (v) return v;
    node = node.parentElement;
  }
  return "?";
}

export function FeedbackOverlay({ targetName }: { targetName: string }) {
  const [active, setActive] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [pending, setPending] = useState<{ variant: string; selector: string; description: string } | null>(null);
  const [pendingText, setPendingText] = useState("");
  const [overall, setOverall] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [hover, setHover] = useState<DOMRect | null>(null);
  const idCounter = useRef(0);

  useEffect(() => {
    if (!active) {
      setHover(null);
      return;
    }
    function onMove(e: MouseEvent) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el.closest("[data-feedback-ui]")) {
        setHover(null);
        return;
      }
      setHover(el.getBoundingClientRect());
    }
    function onClick(e: MouseEvent) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el.closest("[data-feedback-ui]")) return;
      e.preventDefault();
      e.stopPropagation();
      const { selector, description } = describeElement(el);
      const variant = findVariantRoot(el);
      idCounter.current += 1;
      setPending({ variant, selector, description });
      setPendingText("");
    }
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);

  function savePending() {
    if (!pending || !pendingText.trim()) return;
    idCounter.current += 1;
    setComments((prev) => [...prev, { id: `c${idCounter.current}`, ...pending, text: pendingText.trim() }]);
    setPending(null);
    setPendingText("");
  }

  function buildReport(): string {
    const byVariant = new Map<string, Comment[]>();
    for (const c of comments) {
      if (!byVariant.has(c.variant)) byVariant.set(c.variant, []);
      byVariant.get(c.variant)!.push(c);
    }
    let out = `## Design Lab Feedback\n\n**Target:** ${targetName}\n**Comments:** ${comments.length}\n\n`;
    for (const [variant, list] of [...byVariant.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      out += `### Variant ${variant}\n`;
      list.forEach((c, i) => {
        out += `${i + 1}. **${c.description.split(" ")[0]}** (\`${c.selector}\`, ${c.description})\n   "${c.text}"\n`;
      });
      out += "\n";
    }
    out += `### Overall Direction\n${overall.trim() || "(non renseigné)"}\n`;
    return out;
  }

  async function submitAll() {
    const report = buildReport();
    try {
      await navigator.clipboard.writeText(report);
    } catch {
      // clipboard indisponible — l'utilisateur copie manuellement depuis le panneau ci-dessous
    }
    setShowReport(true);
  }

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 999999,
    fontFamily: "Arial, Helvetica, sans-serif",
  };

  return (
    <div data-feedback-ui="root">
      {hover && active && (
        <div
          data-feedback-ui="hover"
          style={{
            ...panelStyle,
            left: hover.left,
            top: hover.top,
            width: hover.width,
            height: hover.height,
            outline: "2px solid #E05010",
            outlineOffset: -2,
            background: "rgba(224,80,16,0.08)",
            pointerEvents: "none",
          }}
        />
      )}

      {!pending && !showReport && (
        <div data-feedback-ui="toolbar" style={{ ...panelStyle, right: 20, bottom: 20, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          {active && (
            <div style={{ background: "#14151a", color: "#fff", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, maxWidth: 260, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
              Clique n'importe quel élément pour laisser un commentaire. {comments.length} commentaire{comments.length !== 1 ? "s" : ""} pour l'instant.
            </div>
          )}
          {comments.length > 0 && (
            <button
              type="button"
              onClick={submitAll}
              style={{
                background: "#901080",
                color: "#fff",
                border: "none",
                borderRadius: 999,
                padding: "10px 18px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 8px 20px rgba(144,16,128,0.35)",
              }}
            >
              ✅ Terminer et générer le rapport ({comments.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setActive((v) => !v)}
            style={{
              background: active ? "#E05010" : "#14151a",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "12px 20px",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
            }}
          >
            {active ? "✕ Arrêter le feedback" : "💬 Ajouter un feedback"}
          </button>
        </div>
      )}

      {pending && (
        <div
          data-feedback-ui="popup"
          style={{
            ...panelStyle,
            inset: 0,
            background: "rgba(20,21,26,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setPending(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, padding: 20, width: 380, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
          >
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8d8e95", marginBottom: 6 }}>
              Variante {pending.variant} — {pending.description}
            </div>
            <code style={{ fontSize: 11, color: "#55565f", display: "block", marginBottom: 12 }}>{pending.selector}</code>
            <textarea
              autoFocus
              value={pendingText}
              onChange={(e) => setPendingText(e.target.value)}
              placeholder="Ton commentaire sur cet élément…"
              rows={3}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e3e3df", fontSize: 13.5, fontFamily: "inherit", resize: "vertical" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setPending(null)}
                style={{ background: "transparent", border: "1px solid #e3e3df", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={savePending}
                disabled={!pendingText.trim()}
                style={{
                  background: "#14151a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: pendingText.trim() ? "pointer" : "default",
                  opacity: pendingText.trim() ? 1 : 0.4,
                }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {showReport && (
        <div
          data-feedback-ui="report"
          style={{ ...panelStyle, inset: 0, background: "rgba(20,21,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 640, maxWidth: "95vw", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Direction générale (obligatoire)</h2>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#55565f" }}>Quelle variante gagne globalement ? Qu'est-ce qu'on garde de chacune ?</p>
            <textarea
              value={overall}
              onChange={(e) => setOverall(e.target.value)}
              rows={3}
              placeholder="Ex : Variante E dans l'ensemble, mais la densité de C pour le tableau…"
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e3e3df", fontSize: 13.5, fontFamily: "inherit", resize: "vertical", marginBottom: 16 }}
            />
            <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>Rapport (copié dans le presse-papiers)</h2>
            <pre
              style={{
                background: "#fafaf8",
                border: "1px solid #e3e3df",
                borderRadius: 8,
                padding: 14,
                fontSize: 11.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
              }}
            >
              {buildReport()}
            </pre>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowReport(false)}
                style={{ background: "transparent", border: "1px solid #e3e3df", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}
              >
                Retour
              </button>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(buildReport()).catch(() => {})}
                style={{ background: "#14151a", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                📋 Recopier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
