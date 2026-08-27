import { useEffect, useRef, useState } from "react";

/**
 * Éditeur de templates email — par blocs.
 *
 * Contrainte du brief : pouvoir composer un email (logo, titre, image,
 * texte, bouton…) ET réordonner ces éléments — un unique canevas de texte
 * libre ne le permettait pas. Chaque élément est donc son propre bloc
 * (texte, image, bouton ou séparateur), affiché dans un encadré avec des
 * boutons ↑ / ↓ / supprimer.
 *
 * Le HTML final envoyé par email reste un simple <div>/<table>/<p> par
 * bloc (styles en inline CSS — les balises <style> sont peu fiables dans
 * les clients email). Chaque bloc est délimité par des commentaires HTML
 * <!--myplv:block:...--> qui portent son type + sa config en JSON : ça
 * permet de re-parser le HTML stocké en blocs à la réouverture, sans rien
 * changer au format déjà en base (bodyHtml = une simple chaîne HTML).
 * Un HTML plus ancien (ou collé en mode "Voir le HTML") sans ces marqueurs
 * est simplement chargé comme un unique bloc de texte — rien n'est perdu.
 */

const FONT_FAMILIES = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
];

const FONT_SIZES = [12, 13, 14, 16, 18, 20, 24, 28, 32];

type Align = "left" | "center" | "right";

type TextBlock = { id: string; kind: "text"; html: string; align: Align };
type ImageBlock = { id: string; kind: "image"; src: string; width: number | null; align: Align; href: string };
type ButtonBlock = { id: string; kind: "button"; label: string; href: string; align: Align; bg: string; color: string };
type DividerBlock = { id: string; kind: "divider" };
type Block = TextBlock | ImageBlock | ButtonBlock | DividerBlock;

let blockIdCounter = 0;
function newId(): string {
  blockIdCounter += 1;
  return `b${Date.now().toString(36)}${blockIdCounter}`;
}

function defaultTextBlock(html = "<p>Votre texte ici…</p>", align: Align = "left"): TextBlock {
  return { id: newId(), kind: "text", html, align };
}
function defaultImageBlock(src: string, width: number | null = null, align: Align = "center"): ImageBlock {
  return { id: newId(), kind: "image", src, width, align, href: "" };
}
function defaultButtonBlock(): ButtonBlock {
  return { id: newId(), kind: "button", label: "En savoir plus", href: "https://myplv.be", align: "center", bg: "#2c4a9e", color: "#ffffff" };
}
function defaultDividerBlock(): DividerBlock {
  return { id: newId(), kind: "divider" };
}

/** Contenu de départ pour un nouveau template — inspiré de la maquette MailPro fournie : logo, titre, image, texte, bouton, pied de page. */
export function starterBlocks(): Block[] {
  return [
    defaultImageBlock("https://app.myplv.be/logo-myplv.png", 120, "center"),
    defaultTextBlock('<p><span style="font-size:22px;font-weight:bold;">Titre de votre email</span></p>', "center"),
    defaultImageBlock("https://placehold.co/560x260/eef1f6/7b8494?text=Image", null, "center"),
    defaultTextBlock("<p>Bonjour {{prenom}},</p><p>Votre contenu ici…</p><p>{{offre}}</p>", "left"),
    defaultButtonBlock(),
    defaultDividerBlock(),
    defaultTextBlock('<p style="font-size:12px;color:#7b8494;">MYPLV — Wavre, Belgique</p>', "center"),
  ];
}

export function starterHtml(): string {
  return blocksToHtml(starterBlocks());
}

function alignStyle(align: Align): string {
  return align === "center" ? "center" : align === "right" ? "right" : "left";
}

function blockBodyHtml(b: Block): string {
  switch (b.kind) {
    case "text":
      return `<div style="text-align:${alignStyle(b.align)};">${b.html}</div>`;
    case "image": {
      const widthAttr = b.width ? ` width="${b.width}"` : "";
      const style = b.width ? `width:${b.width}px;height:auto;max-width:100%;display:inline-block;` : "max-width:100%;height:auto;display:inline-block;";
      const img = `<img src="${b.src}" alt=""${widthAttr} style="${style}" />`;
      const linked = b.href ? `<a href="${b.href}">${img}</a>` : img;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;"><tr><td align="${alignStyle(b.align)}">${linked}</td></tr></table>`;
    }
    case "button":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;"><tr><td align="${alignStyle(b.align)}"><a href="${b.href}" style="background:${b.bg};color:${b.color};padding:12px 28px;border-radius:6px;display:inline-block;text-decoration:none;font-weight:600;font-family:Arial,Helvetica,sans-serif;">${b.label}</a></td></tr></table>`;
    case "divider":
      return `<hr style="border:none;border-top:1px solid #D8DCD3;margin:0;" />`;
  }
}

function blockConfig(b: Block): Record<string, unknown> {
  switch (b.kind) {
    case "text":
      return { align: b.align };
    case "image":
      return { src: b.src, width: b.width, align: b.align, href: b.href };
    case "button":
      return { label: b.label, href: b.href, align: b.align, bg: b.bg, color: b.color };
    case "divider":
      return {};
  }
}

function blockToHtml(b: Block): string {
  const meta = JSON.stringify(blockConfig(b));
  const inner = b.kind === "text" ? b.html : "";
  return `<!--myplv:block:${b.kind}:${meta}-->${inner ? `<!--myplv:html:${btoa(unescape(encodeURIComponent(inner)))}-->` : ""}${blockBodyHtml(b)}<!--/myplv:block-->`;
}

export function blocksToHtml(blocks: Block[]): string {
  return blocks.map((b) => `${blockToHtml(b)}<p>&nbsp;</p>`).join("\n");
}

const BLOCK_RE = /<!--myplv:block:(\w+):([\s\S]*?)-->(?:<!--myplv:html:([\s\S]*?)-->)?[\s\S]*?<!--\/myplv:block-->/g;

/** Reconstruit les blocs à partir du HTML stocké. Si aucun marqueur n'est trouvé (ancien template, ou HTML collé à la main), tout le contenu devient un unique bloc de texte — rien n'est perdu. */
export function htmlToBlocks(html: string): Block[] {
  const trimmed = html.trim();
  if (!trimmed) return [defaultTextBlock("<p>Votre texte ici…</p>")];
  if (!trimmed.includes("<!--myplv:block:")) {
    return [defaultTextBlock(trimmed)];
  }
  const blocks: Block[] = [];
  for (const m of trimmed.matchAll(BLOCK_RE)) {
    const kind = m[1];
    let cfg: Record<string, unknown> = {};
    try {
      cfg = JSON.parse(m[2]);
    } catch {
      cfg = {};
    }
    const textHtml = m[3] ? decodeURIComponent(escape(atob(m[3]))) : "";
    if (kind === "text") {
      blocks.push({ id: newId(), kind: "text", html: textHtml || "<p></p>", align: (cfg.align as Align) || "left" });
    } else if (kind === "image") {
      blocks.push({
        id: newId(),
        kind: "image",
        src: (cfg.src as string) || "",
        width: (cfg.width as number) ?? null,
        align: (cfg.align as Align) || "center",
        href: (cfg.href as string) || "",
      });
    } else if (kind === "button") {
      blocks.push({
        id: newId(),
        kind: "button",
        label: (cfg.label as string) || "En savoir plus",
        href: (cfg.href as string) || "",
        align: (cfg.align as Align) || "center",
        bg: (cfg.bg as string) || "#2c4a9e",
        color: (cfg.color as string) || "#ffffff",
      });
    } else if (kind === "divider") {
      blocks.push({ id: newId(), kind: "divider" });
    }
  }
  return blocks.length > 0 ? blocks : [defaultTextBlock(trimmed)];
}

function wrapSelectionWithStyle(range: Range, styleProp: string, value: string): boolean {
  const span = document.createElement("span");
  span.style.setProperty(styleProp, value);
  try {
    const content = range.extractContents();
    span.appendChild(content);
    range.insertNode(span);
    const sel = window.getSelection();
    if (sel) {
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    return true;
  } catch {
    return false;
  }
}

const ALIGN_OPTIONS: { value: Align; label: string }[] = [
  { value: "left", label: "⯇" },
  { value: "center", label: "☰" },
  { value: "right", label: "⯈" },
];

function AlignPicker({ value, onChange }: { value: Align; onChange: (a: Align) => void }) {
  return (
    <span className="block-align-picker">
      {ALIGN_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`btn ${value === o.value ? "btn-primary" : ""}`}
          title={o.value === "left" ? "Aligner à gauche" : o.value === "center" ? "Centrer" : "Aligner à droite"}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

function ImagePicker({
  onPick,
  onCancel,
  label,
}: {
  onPick: (src: string) => void;
  onCancel: () => void;
  label: string;
}) {
  const [url, setUrl] = useState("");
  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onPick(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  return (
    <div className="rich-editor-image-panel">
      <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{label}</span>
      <input type="text" placeholder="https://…/image.png" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1 }} />
      <button type="button" className="btn btn-primary" onClick={() => url.trim() && onPick(url.trim())}>
        Utiliser l'URL
      </button>
      <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>ou</span>
      <label className="btn" style={{ cursor: "pointer" }}>
        Importer un fichier
        <input type="file" accept="image/*" onChange={handleFilePick} style={{ display: "none" }} />
      </label>
      <button type="button" className="btn" onClick={onCancel}>
        Annuler
      </button>
    </div>
  );
}

function BlockChrome({
  label,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  extra,
  children,
}: {
  label: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="email-block">
      <div className="email-block-head">
        <span className="email-block-label">{label}</span>
        {extra}
        <span className="email-block-spacer" />
        <button type="button" className="btn" title="Monter" disabled={isFirst} onClick={onMoveUp}>
          ↑
        </button>
        <button type="button" className="btn" title="Descendre" disabled={isLast} onClick={onMoveDown}>
          ↓
        </button>
        <button type="button" className="btn" title="Supprimer ce bloc" onClick={onDelete}>
          🗑
        </button>
      </div>
      <div className="email-block-body">{children}</div>
    </div>
  );
}

export function RichEmailEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState(value);
  const [blocks, setBlocks] = useState<Block[]>(() => htmlToBlocks(value));
  // Ne re-parse depuis "value" que si le changement vient de l'extérieur
  // (sélection d'un autre template, retour du mode HTML) — jamais après
  // notre propre emitChange, sous peine de perdre le focus/curseur en cours.
  const lastEmittedRef = useRef<string>(blocksToHtml(blocks));
  const textRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const savedRangeRef = useRef<Range | null>(null);
  const [imagePanelFor, setImagePanelFor] = useState<string | null>(null);
  // Le contentEditable de chaque bloc texte est volontairement "non
  // contrôlé" après son montage initial : dangerouslySetInnerHTML est figé
  // sur le HTML de départ pour cet id de bloc et n'est plus jamais mis à
  // jour depuis le state pendant que l'utilisateur tape (sinon React
  // réécrirait innerHTML à chaque frappe et le curseur sauterait). Le
  // contenu réel remonte quand même dans "blocks" via handleTextInput, pour
  // la sérialisation. Un changement externe (autre template, sortie du
  // mode HTML) donne de nouveaux id de bloc → React remonte alors le nœud
  // avec le bon contenu.
  const initialHtmlRef = useRef<Map<string, string>>(new Map());
  function getInitialHtml(id: string, fallback: string): string {
    if (!initialHtmlRef.current.has(id)) initialHtmlRef.current.set(id, fallback);
    return initialHtmlRef.current.get(id)!;
  }

  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    setBlocks(htmlToBlocks(value));
    setRawText(value);
  }, [value]);

  function commit(next: Block[]) {
    setBlocks(next);
    const html = blocksToHtml(next);
    lastEmittedRef.current = html;
    onChange(html);
  }

  function updateBlock(id: string, patch: Partial<Block>) {
    commit(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  }

  function moveBlock(id: string, dir: -1 | 1) {
    const idx = blocks.findIndex((b) => b.id === id);
    const swapWith = idx + dir;
    if (idx < 0 || swapWith < 0 || swapWith >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    commit(next);
  }

  function deleteBlock(id: string) {
    initialHtmlRef.current.delete(id);
    textRefs.current.delete(id);
    commit(blocks.filter((b) => b.id !== id));
  }

  function addBlock(kind: Block["kind"]) {
    const block =
      kind === "text"
        ? defaultTextBlock()
        : kind === "image"
          ? defaultImageBlock("https://placehold.co/560x260/eef1f6/7b8494?text=Image")
          : kind === "button"
            ? defaultButtonBlock()
            : defaultDividerBlock();
    commit([...blocks, block]);
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const anchor = sel.anchorNode;
    const withinEditor = [...textRefs.current.values()].some((el) => el.contains(anchor));
    if (withinEditor) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  }

  function applyStyle(styleProp: string, val: string) {
    let sel = window.getSelection();
    const withinEditor = !!sel && sel.rangeCount > 0 && !sel.isCollapsed && [...textRefs.current.values()].some((el) => el.contains(sel!.anchorNode));
    if (!withinEditor && savedRangeRef.current) {
      sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRangeRef.current);
    }
    sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const container = [...textRefs.current.entries()].find(([, el]) => el.contains(range.commonAncestorContainer));
    if (!container) return;
    wrapSelectionWithStyle(range, styleProp, val);
    savedRangeRef.current = null;
    const [blockId, el] = container;
    updateBlock(blockId, { html: el.innerHTML } as Partial<TextBlock>);
  }

  function handleTextInput(id: string) {
    const el = textRefs.current.get(id);
    if (!el) return;
    updateBlock(id, { html: el.innerHTML } as Partial<TextBlock>);
  }

  function switchToRaw() {
    setRawText(blocksToHtml(blocks));
    setRawMode(true);
  }

  function switchToVisual() {
    lastEmittedRef.current = rawText;
    setBlocks(htmlToBlocks(rawText));
    onChange(rawText);
    setRawMode(false);
  }

  return (
    <div className="rich-editor">
      <div className="rich-editor-toolbar">
        <button type="button" className="btn" title="Gras" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle("font-weight", "bold")}>
          <strong>G</strong>
        </button>
        <button type="button" className="btn" title="Italique" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle("font-style", "italic")}>
          <em>I</em>
        </button>
        <button type="button" className="btn" title="Souligné" onMouseDown={(e) => e.preventDefault()} onClick={() => applyStyle("text-decoration", "underline")}>
          <span style={{ textDecoration: "underline" }}>S</span>
        </button>

        <span className="rich-editor-sep" />

        <select
          title="Police"
          defaultValue=""
          onMouseDown={saveSelection}
          onChange={(e) => {
            if (e.target.value) applyStyle("font-family", e.target.value);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Police…
          </option>
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          title="Corps (taille de texte)"
          defaultValue=""
          onMouseDown={saveSelection}
          onChange={(e) => {
            if (e.target.value) applyStyle("font-size", `${e.target.value}px`);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Corps…
          </option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}px
            </option>
          ))}
        </select>

        <label className="rich-editor-color" title="Couleur du texte (pipette)">
          <span style={{ fontSize: 11 }}>A</span>
          <input type="color" defaultValue="#1c2230" onMouseDown={saveSelection} onChange={(e) => applyStyle("color", e.target.value)} />
        </label>

        <span className="rich-editor-sep" />

        <button type="button" className="btn" onClick={rawMode ? switchToVisual : switchToRaw} style={{ marginLeft: "auto" }}>
          {rawMode ? "Éditeur visuel" : "Voir le HTML"}
        </button>
      </div>

      {rawMode ? (
        <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={14} className="rich-editor-raw" />
      ) : (
        <div className="email-blocks">
          {blocks.length === 0 && <div className="empty-state">Aucun bloc — ajoute-en un ci-dessous.</div>}
          {blocks.map((b, i) => {
            const common = {
              isFirst: i === 0,
              isLast: i === blocks.length - 1,
              onMoveUp: () => moveBlock(b.id, -1),
              onMoveDown: () => moveBlock(b.id, 1),
              onDelete: () => deleteBlock(b.id),
            };
            if (b.kind === "text") {
              return (
                <BlockChrome key={b.id} label="Texte" {...common} extra={<AlignPicker value={b.align} onChange={(align) => updateBlock(b.id, { align })} />}>
                  <div
                    ref={(el) => {
                      if (el) textRefs.current.set(b.id, el);
                      else textRefs.current.delete(b.id);
                    }}
                    className="rich-editor-surface email-block-text"
                    style={{ textAlign: b.align }}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => handleTextInput(b.id)}
                    onBlur={() => handleTextInput(b.id)}
                    dangerouslySetInnerHTML={{ __html: getInitialHtml(b.id, b.html) }}
                  />
                </BlockChrome>
              );
            }
            if (b.kind === "image") {
              return (
                <BlockChrome key={b.id} label="Image" {...common} extra={<AlignPicker value={b.align} onChange={(align) => updateBlock(b.id, { align })} />}>
                  {imagePanelFor === b.id ? (
                    <ImagePicker
                      label="Remplacer par :"
                      onCancel={() => setImagePanelFor(null)}
                      onPick={(src) => {
                        updateBlock(b.id, { src } as Partial<ImageBlock>);
                        setImagePanelFor(null);
                      }}
                    />
                  ) : (
                    <div className="email-block-image-preview" style={{ justifyContent: alignStyle(b.align) as "left" | "center" | "right" }}>
                      {b.src ? <img src={b.src} alt="" style={b.width ? { width: b.width } : undefined} /> : <span className="empty-state">Aucune image</span>}
                    </div>
                  )}
                  <div className="email-block-controls">
                    <button type="button" className="btn" onClick={() => setImagePanelFor(imagePanelFor === b.id ? null : b.id)}>
                      Remplacer l'image
                    </button>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                      Largeur
                      <input
                        type="number"
                        min={10}
                        placeholder="auto"
                        value={b.width ?? ""}
                        onChange={(e) => updateBlock(b.id, { width: e.target.value ? Number(e.target.value) : null } as Partial<ImageBlock>)}
                        style={{ width: 72, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
                      />
                      px
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, flex: 1 }}>
                      Lien (optionnel)
                      <input
                        type="text"
                        placeholder="https://…"
                        value={b.href}
                        onChange={(e) => updateBlock(b.id, { href: e.target.value } as Partial<ImageBlock>)}
                        style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
                      />
                    </label>
                  </div>
                </BlockChrome>
              );
            }
            if (b.kind === "button") {
              return (
                <BlockChrome key={b.id} label="Bouton" {...common} extra={<AlignPicker value={b.align} onChange={(align) => updateBlock(b.id, { align })} />}>
                  <div className="email-block-controls">
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                      Texte
                      <input
                        type="text"
                        value={b.label}
                        onChange={(e) => updateBlock(b.id, { label: e.target.value } as Partial<ButtonBlock>)}
                        style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
                      />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, flex: 1 }}>
                      Lien
                      <input
                        type="text"
                        placeholder="https://…"
                        value={b.href}
                        onChange={(e) => updateBlock(b.id, { href: e.target.value } as Partial<ButtonBlock>)}
                        style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
                      />
                    </label>
                    <label className="rich-editor-color" title="Couleur de fond">
                      Fond
                      <input type="color" value={b.bg} onChange={(e) => updateBlock(b.id, { bg: e.target.value } as Partial<ButtonBlock>)} />
                    </label>
                    <label className="rich-editor-color" title="Couleur du texte">
                      Texte
                      <input type="color" value={b.color} onChange={(e) => updateBlock(b.id, { color: e.target.value } as Partial<ButtonBlock>)} />
                    </label>
                  </div>
                  <div className="email-block-image-preview" style={{ justifyContent: alignStyle(b.align) as "left" | "center" | "right" }}>
                    <span style={{ background: b.bg, color: b.color, padding: "10px 22px", borderRadius: 6, fontWeight: 600, fontSize: 13.5, display: "inline-block" }}>
                      {b.label || "…"}
                    </span>
                  </div>
                </BlockChrome>
              );
            }
            return (
              <BlockChrome key={b.id} label="Séparateur" {...common}>
                <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: 0 }} />
              </BlockChrome>
            );
          })}
        </div>
      )}

      {!rawMode && (
        <div className="rich-editor-toolbar email-add-block-bar">
          <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>Ajouter un bloc :</span>
          <button type="button" className="btn" onClick={() => addBlock("text")}>
            + Texte
          </button>
          <button type="button" className="btn" onClick={() => addBlock("image")}>
            + Image
          </button>
          <button type="button" className="btn" onClick={() => addBlock("button")}>
            + Bouton
          </button>
          <button type="button" className="btn" onClick={() => addBlock("divider")}>
            + Séparateur
          </button>
        </div>
      )}
    </div>
  );
}
