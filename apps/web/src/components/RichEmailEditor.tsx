import { useEffect, useRef, useState } from "react";

/**
 * Éditeur de templates email — par blocs, réordonnables par glisser-déposer.
 *
 * Chaque élément (texte, image, bouton, séparateur) est son propre bloc,
 * affiché dans un encadré avec une poignée de glisser-déposer. Le drag est
 * en HTML5 natif (aucune dépendance) : la poignée seule est "draggable"
 * (pas le bloc entier), pour ne jamais interférer avec la sélection de
 * texte ou les champs à l'intérieur — mais l'aperçu déplacé pendant le
 * drag est celui du bloc entier (dataTransfer.setDragImage).
 *
 * Le HTML final envoyé par email reste un simple <div>/<table>/<p> par
 * bloc (styles en inline CSS — les balises <style> sont peu fiables dans
 * les clients email). Chaque bloc est délimité par des commentaires HTML
 * <!--myplv:block:...--> qui portent son type + sa config en JSON : ça
 * permet de re-parser le HTML stocké en blocs à la réouverture, sans rien
 * changer au format déjà en base (bodyHtml = une simple chaîne HTML).
 * Un HTML plus ancien (ou collé en mode "Voir le HTML") sans ces marqueurs
 * est simplement chargé comme un unique bloc de texte — rien n'est perdu.
 *
 * Favoris de couleurs, blocs réutilisables (ex. un pied de page toujours
 * identique) et mises en page enregistrées sont stockés dans le
 * localStorage du navigateur — pratique et sans backend à faire évoluer,
 * mais propre à cet appareil/navigateur (pas partagé entre collègues ou
 * entre ordinateurs). À migrer côté serveur si ça devient un problème.
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

type TextBlock = { id: string; kind: "text"; html: string; align: Align; role?: "footer" };
type ImageBlock = { id: string; kind: "image"; src: string; width: number | null; align: Align; href: string };
type ButtonBlock = { id: string; kind: "button"; label: string; href: string; align: Align; bg: string; color: string };
type DividerBlock = { id: string; kind: "divider" };
type Block = TextBlock | ImageBlock | ButtonBlock | DividerBlock;

let blockIdCounter = 0;
function newId(): string {
  blockIdCounter += 1;
  return `b${Date.now().toString(36)}${blockIdCounter}`;
}

function cloneWithNewId(b: Block): Block {
  return { ...b, id: newId() };
}

function defaultTextBlock(html = "<p>Votre texte ici…</p>", align: Align = "left", role?: "footer"): TextBlock {
  return { id: newId(), kind: "text", html, align, role };
}
function defaultImageBlock(src: string, width: number | null = null, align: Align = "center"): ImageBlock {
  return { id: newId(), kind: "image", src, width, align, href: "" };
}
function defaultButtonBlock(): ButtonBlock {
  return { id: newId(), kind: "button", label: "En savoir plus", href: "https://myplv.be", align: "center", bg: "#14151a", color: "#ffffff" };
}
function defaultDividerBlock(): DividerBlock {
  return { id: newId(), kind: "divider" };
}

/** Contenu de départ pour un nouveau template : logo MYPLV, une zone de texte, une zone image, un pied de page. */
export function starterBlocks(): Block[] {
  return [
    defaultImageBlock("https://app.myplv.be/logo-myplv.png", 250, "center"),
    defaultTextBlock("<p>Bonjour {{prenom}},</p><p>Votre contenu ici…</p><p>{{offre}}</p>", "left"),
    defaultImageBlock("https://placehold.co/560x260/eef1f6/7b8494?text=Image", null, "center"),
    defaultTextBlock('<p style="font-size:12px;color:#7b8494;">MYPLV — Wavre, Belgique</p>', "center", "footer"),
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
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;"><tr><td align="${alignStyle(b.align)}"><a href="${b.href}" style="background:${b.bg};color:${b.color};padding:12px 28px;border-radius:2px;display:inline-block;text-decoration:none;font-weight:600;font-family:Arial,Helvetica,sans-serif;">${b.label}</a></td></tr></table>`;
    case "divider":
      return `<hr style="border:none;border-top:1px solid #D8DCD3;margin:0;" />`;
  }
}

function blockConfig(b: Block): Record<string, unknown> {
  switch (b.kind) {
    case "text":
      return { align: b.align, role: b.role };
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
      blocks.push({
        id: newId(),
        kind: "text",
        html: textHtml || "<p></p>",
        align: (cfg.align as Align) || "left",
        role: cfg.role === "footer" ? "footer" : undefined,
      });
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
        bg: (cfg.bg as string) || "#14151a",
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

// --- Persistance locale (navigateur) : favoris couleur, blocs réutilisables, mises en page ---

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLocal<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage plein ou indisponible (navigation privée…) — on ignore, l'édition en cours reste utilisable.
  }
}

const COLOR_FAVORITES_KEY = "myplv:emailEditor:colorFavorites";
const SNIPPETS_KEY = "myplv:emailEditor:blockSnippets";
const LAYOUTS_KEY = "myplv:emailEditor:layouts";

type Snippet = { id: string; name: string; block: Block };
type SavedLayout = { id: string; name: string; blocks: Block[]; savedAt: string };

function normalizeHex(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!s.startsWith("#")) s = "#" + s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    s = "#" + s
      .slice(1)
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : null;
}

function useClickOutside(active: boolean, onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return ref;
}

/** Pipette de couleur : saisie hexadécimale libre + favoris enregistrés (partagés entre tous les sélecteurs de couleur du template). */
function ColorPicker({ value, onChange, title, onOpen }: { value: string; onChange: (hex: string) => void; title: string; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const [favorites, setFavorites] = useState<string[]>(() => readLocal(COLOR_FAVORITES_KEY, [] as string[]));
  const rootRef = useClickOutside(open, () => setOpen(false));

  useEffect(() => {
    setHexInput(value);
  }, [value, open]);

  function commitHex(raw: string) {
    const hex = normalizeHex(raw);
    if (hex) onChange(hex);
  }

  function addFavorite() {
    // hexInput reflète le dernier choix de l'utilisateur (saisie ou pipette
    // native) — "value" reste souvent une couleur par défaut figée (ex. le
    // sélecteur "couleur du texte" de la barre d'outils, qui ne suit pas la
    // couleur du texte sélectionné), donc jamais la bonne source ici.
    const hex = normalizeHex(hexInput) ?? normalizeHex(value);
    if (!hex || favorites.includes(hex)) return;
    const next = [...favorites, hex].slice(-18);
    setFavorites(next);
    writeLocal(COLOR_FAVORITES_KEY, next);
  }

  function removeFavorite(hex: string) {
    const next = favorites.filter((f) => f !== hex);
    setFavorites(next);
    writeLocal(COLOR_FAVORITES_KEY, next);
  }

  const hexValid = normalizeHex(hexInput) !== null;

  return (
    <div className="color-picker" ref={rootRef}>
      <button
        type="button"
        className="color-picker-swatch"
        title={title}
        style={{ background: normalizeHex(hexInput) || value }}
        onMouseDown={onOpen}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="color-picker-panel" onClick={(e) => e.stopPropagation()}>
          <div className="color-picker-row">
            <input
              type="color"
              value={normalizeHex(hexInput) || normalizeHex(value) || "#000000"}
              onChange={(e) => {
                setHexInput(e.target.value);
                onChange(e.target.value);
              }}
            />
            <input
              type="text"
              className={`color-picker-hex ${hexInput && !hexValid ? "invalid" : ""}`}
              placeholder="#1a2b3c"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={() => commitHex(hexInput)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitHex(hexInput);
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
            <button type="button" className="icon-btn" title="Ajouter aux favoris" onClick={addFavorite}>
              ★
            </button>
          </div>
          {favorites.length === 0 ? (
            <span className="color-picker-favorites-empty">Aucun favori — ★ pour en ajouter un.</span>
          ) : (
            <div className="color-picker-favorites">
              {favorites.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className="color-swatch"
                  title={`${hex} (clic droit pour retirer)`}
                  style={{ background: hex }}
                  onClick={() => {
                    onChange(hex);
                    setHexInput(hex);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    removeFavorite(hex);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ALIGN_OPTIONS: { value: Align; label: string; title: string }[] = [
  { value: "left", label: "⯇", title: "Aligner à gauche" },
  { value: "center", label: "☰", title: "Centrer" },
  { value: "right", label: "⯈", title: "Aligner à droite" },
];

function AlignPicker({ value, onChange }: { value: Align; onChange: (a: Align) => void }) {
  return (
    <span className="block-align-picker">
      {ALIGN_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`icon-btn ${value === o.value ? "active" : ""}`}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

function ImagePicker({ onPick, onCancel, label }: { onPick: (src: string) => void; onCancel: () => void; label: string }) {
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
        Télécharger un fichier
        <input type="file" accept="image/*" onChange={handleFilePick} style={{ display: "none" }} />
      </label>
      <button type="button" className="btn" onClick={onCancel}>
        Annuler
      </button>
    </div>
  );
}

function labelFor(b: Block): string {
  if (b.kind === "text") return b.role === "footer" ? "Pied de page" : "Texte";
  if (b.kind === "image") return "Image";
  if (b.kind === "button") return "Bouton";
  return "Séparateur";
}

type DropPos = "before" | "after";

function BlockChrome({
  label,
  dragging,
  dropIndicator,
  onDragHandleStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onDelete,
  onSaveSnippet,
  extra,
  children,
}: {
  label: string;
  dragging: boolean;
  dropIndicator: DropPos | null;
  onDragHandleStart: (e: React.DragEvent, blockEl: HTMLDivElement | null) => void;
  onDragOver: (e: React.DragEvent, blockEl: HTMLDivElement | null) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDelete: () => void;
  onSaveSnippet: () => void;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const blockRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={blockRef}
      className={`email-block ${dragging ? "is-dragging" : ""} ${dropIndicator ? `drop-${dropIndicator}` : ""}`}
      onDragOver={(e) => onDragOver(e, blockRef.current)}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="email-block-head">
        <span className="block-drag-handle" title="Glisser pour réordonner" draggable onDragStart={(e) => onDragHandleStart(e, blockRef.current)} onDragEnd={onDragEnd}>
          ⠿
        </span>
        <span className="email-block-label">{label}</span>
        {extra}
        <span className="email-block-spacer" />
        <button type="button" className="icon-btn" title="Enregistrer comme bloc réutilisable" onClick={onSaveSnippet}>
          💾
        </button>
        <button type="button" className="icon-btn danger" title="Supprimer ce bloc" onClick={onDelete}>
          ✕
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

  // Glisser-déposer : id du bloc en cours de déplacement + id du bloc
  // survolé et position (avant/après) pour l'indicateur visuel.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overPos, setOverPos] = useState<DropPos | null>(null);

  // Blocs réutilisables et mises en page enregistrées (localStorage).
  const [snippets, setSnippets] = useState<Snippet[]>(() => readLocal(SNIPPETS_KEY, [] as Snippet[]));
  const [libraryOpen, setLibraryOpen] = useState(false);
  const libraryRef = useClickOutside(libraryOpen, () => setLibraryOpen(false));
  const [layouts, setLayouts] = useState<SavedLayout[]>(() => readLocal(LAYOUTS_KEY, [] as SavedLayout[]));
  const [showLayouts, setShowLayouts] = useState(false);

  if (value !== lastEmittedRef.current && value !== rawText) {
    // Changement externe (sélection d'un autre template, ou un parent qui
    // réinitialise value) détecté au rendu plutôt qu'en effet, pour éviter
    // un rendu intermédiaire avec les anciens blocs.
    lastEmittedRef.current = value;
    setBlocks(htmlToBlocks(value));
    setRawText(value);
  }

  function commit(next: Block[]) {
    setBlocks(next);
    const html = blocksToHtml(next);
    lastEmittedRef.current = html;
    onChange(html);
  }

  function updateBlock(id: string, patch: Partial<Block>) {
    commit(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
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

  function handleSaveSnippet(block: Block) {
    const name = window.prompt("Nom de ce bloc réutilisable :", labelFor(block));
    if (!name || !name.trim()) return;
    const next = [...snippets, { id: newId(), name: name.trim(), block: { ...block } }];
    setSnippets(next);
    writeLocal(SNIPPETS_KEY, next);
  }

  function deleteSnippet(id: string) {
    const next = snippets.filter((s) => s.id !== id);
    setSnippets(next);
    writeLocal(SNIPPETS_KEY, next);
  }

  function insertSnippet(s: Snippet) {
    commit([...blocks, cloneWithNewId(s.block)]);
    setLibraryOpen(false);
  }

  function handleSaveLayout() {
    const name = window.prompt("Nom de cette mise en page :");
    if (!name || !name.trim()) return;
    const next = [...layouts, { id: newId(), name: name.trim(), blocks: blocks.map((b) => ({ ...b })), savedAt: new Date().toISOString() }];
    setLayouts(next);
    writeLocal(LAYOUTS_KEY, next);
  }

  function deleteLayout(id: string) {
    const next = layouts.filter((l) => l.id !== id);
    setLayouts(next);
    writeLocal(LAYOUTS_KEY, next);
  }

  function applyLayout(l: SavedLayout) {
    commit(l.blocks.map(cloneWithNewId));
    setShowLayouts(false);
  }

  function handleDragHandleStart(e: React.DragEvent, blockId: string, blockEl: HTMLDivElement | null) {
    setDragId(blockId);
    e.dataTransfer.effectAllowed = "move";
    if (blockEl) {
      const rect = blockEl.getBoundingClientRect();
      e.dataTransfer.setDragImage(blockEl, Math.min(24, rect.width / 2), 14);
    }
  }

  function handleDragOver(e: React.DragEvent, blockId: string, blockEl: HTMLDivElement | null) {
    if (!dragId || dragId === blockId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = blockEl?.getBoundingClientRect();
    const pos: DropPos = rect && e.clientY - rect.top > rect.height / 2 ? "after" : "before";
    setOverId(blockId);
    setOverPos(pos);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!dragId || !overId || dragId === overId) {
      resetDrag();
      return;
    }
    const fromIdx = blocks.findIndex((b) => b.id === dragId);
    const toIdx = blocks.findIndex((b) => b.id === overId);
    if (fromIdx < 0 || toIdx < 0) {
      resetDrag();
      return;
    }
    const next = [...blocks];
    const [moved] = next.splice(fromIdx, 1);
    let insertAt = next.findIndex((b) => b.id === overId);
    if (overPos === "after") insertAt += 1;
    next.splice(insertAt, 0, moved);
    commit(next);
    resetDrag();
  }

  function resetDrag() {
    setDragId(null);
    setOverId(null);
    setOverPos(null);
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

        <ColorPicker value="#1c2230" title="Couleur du texte" onOpen={saveSelection} onChange={(hex) => applyStyle("color", hex)} />

        <span className="rich-editor-sep" />

        <button type="button" className="btn" style={{ marginLeft: "auto" }} onClick={() => setShowLayouts(true)}>
          📐 Mes mises en page
        </button>
        <button type="button" className="btn" onClick={rawMode ? switchToVisual : switchToRaw}>
          {rawMode ? "Éditeur visuel" : "Voir le HTML"}
        </button>
      </div>

      {rawMode ? (
        <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={14} className="rich-editor-raw" />
      ) : (
        <div className="email-blocks">
          {blocks.length === 0 && <div className="empty-state">Aucun bloc — ajoute-en un ci-dessous.</div>}
          {blocks.map((b) => {
            const common = {
              label: labelFor(b),
              dragging: dragId === b.id,
              dropIndicator: overId === b.id && dragId && dragId !== b.id ? overPos : null,
              onDragHandleStart: (e: React.DragEvent, el: HTMLDivElement | null) => handleDragHandleStart(e, b.id, el),
              onDragOver: (e: React.DragEvent, el: HTMLDivElement | null) => handleDragOver(e, b.id, el),
              onDragLeave: () => {
                if (overId === b.id) {
                  setOverId(null);
                  setOverPos(null);
                }
              },
              onDrop: handleDrop,
              onDragEnd: resetDrag,
              onDelete: () => deleteBlock(b.id),
              onSaveSnippet: () => handleSaveSnippet(b),
            };
            if (b.kind === "text") {
              return (
                <BlockChrome key={b.id} {...common} extra={<AlignPicker value={b.align} onChange={(align) => updateBlock(b.id, { align })} />}>
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
                <BlockChrome key={b.id} {...common} extra={<AlignPicker value={b.align} onChange={(align) => updateBlock(b.id, { align })} />}>
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
                      Télécharger / remplacer l'image
                    </button>
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      Largeur
                      <input
                        type="number"
                        min={10}
                        placeholder="auto"
                        value={b.width ?? ""}
                        onChange={(e) => updateBlock(b.id, { width: e.target.value ? Number(e.target.value) : null } as Partial<ImageBlock>)}
                        style={{ width: 72 }}
                      />
                      px
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                      Lien (optionnel)
                      <input
                        type="text"
                        placeholder="https://…"
                        value={b.href}
                        onChange={(e) => updateBlock(b.id, { href: e.target.value } as Partial<ImageBlock>)}
                        style={{ flex: 1 }}
                      />
                    </label>
                  </div>
                </BlockChrome>
              );
            }
            if (b.kind === "button") {
              return (
                <BlockChrome key={b.id} {...common} extra={<AlignPicker value={b.align} onChange={(align) => updateBlock(b.id, { align })} />}>
                  <div className="email-block-controls">
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      Texte
                      <input type="text" value={b.label} onChange={(e) => updateBlock(b.id, { label: e.target.value } as Partial<ButtonBlock>)} />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                      Lien
                      <input
                        type="text"
                        placeholder="https://…"
                        value={b.href}
                        onChange={(e) => updateBlock(b.id, { href: e.target.value } as Partial<ButtonBlock>)}
                        style={{ flex: 1 }}
                      />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      Couleur fond
                      <ColorPicker value={b.bg} title="Couleur de fond" onChange={(hex) => updateBlock(b.id, { bg: hex } as Partial<ButtonBlock>)} />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      Couleur texte
                      <ColorPicker value={b.color} title="Couleur du texte" onChange={(hex) => updateBlock(b.id, { color: hex } as Partial<ButtonBlock>)} />
                    </label>
                  </div>
                  <div className="email-block-image-preview" style={{ justifyContent: alignStyle(b.align) as "left" | "center" | "right" }}>
                    <span style={{ background: b.bg, color: b.color, padding: "10px 22px", borderRadius: 2, fontWeight: 600, fontSize: 13.5, display: "inline-block" }}>
                      {b.label || "…"}
                    </span>
                  </div>
                </BlockChrome>
              );
            }
            return (
              <BlockChrome key={b.id} {...common}>
                <div style={{ padding: "14px 12px" }}>
                  <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: 0 }} />
                </div>
              </BlockChrome>
            );
          })}
        </div>
      )}

      {!rawMode && (
        <div className="email-add-block-bar">
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
          <div className="block-library" ref={libraryRef}>
            <button type="button" className="btn" onClick={() => setLibraryOpen((v) => !v)}>
              📚 Mes blocs ({snippets.length})
            </button>
            {libraryOpen && (
              <div className="block-library-panel">
                {snippets.length === 0 ? (
                  <div className="block-library-empty">
                    Aucun bloc enregistré — utilise 💾 sur un bloc (ex. ton pied de page) pour pouvoir le réutiliser tel quel dans tes prochains templates.
                  </div>
                ) : (
                  snippets.map((s) => (
                    <div key={s.id} className="block-library-item">
                      <button type="button" className="name-btn" onClick={() => insertSnippet(s)}>
                        {s.name}
                      </button>
                      <button type="button" className="icon-btn danger" title="Supprimer ce bloc enregistré" onClick={() => deleteSnippet(s.id)}>
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showLayouts && (
        <div className="modal-backdrop" onClick={() => setShowLayouts(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <h2>Mes mises en page</h2>
            <p className="lede" style={{ fontSize: 13, margin: "0 0 16px" }}>
              Enregistre la structure actuelle (logo, textes, images, boutons — dans l'ordre) pour repartir de là dans un futur template.
            </p>
            <button type="button" className="btn btn-primary" onClick={handleSaveLayout}>
              Enregistrer la mise en page actuelle
            </button>
            {layouts.length === 0 ? (
              <p className="empty-state">Aucune mise en page enregistrée pour l'instant.</p>
            ) : (
              <div className="layout-grid">
                {layouts.map((l) => (
                  <div key={l.id} className="layout-card">
                    <div className="layout-thumb">
                      <div className="layout-thumb-inner" dangerouslySetInnerHTML={{ __html: blocksToHtml(l.blocks) }} />
                    </div>
                    <div className="layout-card-body">
                      <span className="layout-card-name">{l.name}</span>
                      <span className="layout-card-date">{new Date(l.savedAt).toLocaleDateString("fr-BE")}</span>
                      <div className="layout-card-actions">
                        <button type="button" className="btn btn-primary" onClick={() => applyLayout(l)}>
                          Utiliser
                        </button>
                        <button type="button" className="btn" onClick={() => deleteLayout(l.id)}>
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowLayouts(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
