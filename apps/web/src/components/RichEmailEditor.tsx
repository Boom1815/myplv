import { useEffect, useRef, useState } from "react";
import { renderTemplate, SAMPLE_VARIABLES } from "@myplv/email";

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

// Largeur par défaut d'une image "Auto" (pas de largeur explicite) — sans
// ce plafond, une image plus large que la colonne (très fréquent — une
// photo, un visuel importé…) remplit tout l'espace disponible et
// l'alignement gauche/centre/droite n'a alors plus aucun effet visible
// (rien ne "flotte" dans une image qui occupe déjà 100% de la largeur).
// Le champ "Largeur" reste disponible pour une valeur précise, et
// "Original" pour revenir à la taille native du fichier.
const AUTO_IMAGE_MAX = 400;

// Largeur de colonne standard d'un email (en px) — même valeur que le
// plafond des tables "outer/inner" générées par blocksToHtml et par
// appendUnsubscribeFooter, pour que le contenu et le pied de page
// s'alignent exactement sur la même colonne centrée dans tous les
// clients mail (Outlook compris, qui ignore max-width en CSS).
const EMAIL_WIDTH = 600;

type Align = "left" | "center" | "right";

type TextBlock = { id: string; kind: "text"; html: string; align: Align; role?: "footer" };
type ImageBlock = { id: string; kind: "image"; src: string; width: number | null; align: Align; href: string };
type ButtonBlock = { id: string; kind: "button"; label: string; href: string; align: Align; bg: string; color: string };
type DividerBlock = { id: string; kind: "divider" };
type SpacerBlock = { id: string; kind: "spacer"; height: number };
type SocialBlock = { id: string; kind: "social"; align: Align; links: Record<string, string> };
// Colonne côte à côte (ex. logo à gauche, coordonnées à droite, séparateur
// vertical entre les deux — mise en page de signature classique). Chaque
// côté est une pile de blocs indépendante — mêmes types qu'au niveau
// racine, à l'exception de "columns" lui-même (pas de colonnes imbriquées,
// pour rester lisible). leftWidth est un pourcentage (10-90) de la largeur
// totale ; le reste revient à droite.
type ColumnsBlock = { id: string; kind: "columns"; left: Block[]; right: Block[]; leftWidth: number; divider: boolean };
export type Block = TextBlock | ImageBlock | ButtonBlock | DividerBlock | SpacerBlock | SocialBlock | ColumnsBlock;

/** Réseaux proposés dans le bloc "Réseaux sociaux" — un champ URL par réseau, vide = pas affiché à l'envoi. */
const SOCIAL_NETWORKS: { key: string; name: string; label: string; bg: string; placeholder: string }[] = [
  { key: "facebook", name: "Facebook", label: "f", bg: "#1877F2", placeholder: "https://facebook.com/…" },
  { key: "instagram", name: "Instagram", label: "IG", bg: "#C13584", placeholder: "https://instagram.com/…" },
  { key: "linkedin", name: "LinkedIn", label: "in", bg: "#0A66C2", placeholder: "https://linkedin.com/company/…" },
  { key: "x", name: "X (Twitter)", label: "X", bg: "#000000", placeholder: "https://x.com/…" },
  { key: "youtube", name: "YouTube", label: "YT", bg: "#FF0000", placeholder: "https://youtube.com/…" },
];

/** Icône ronde encodée en data URI (image, pas balise <svg> — bien plus fiable dans les clients email). */
function socialIconDataUri(label: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="${bg}"/><text x="16" y="21" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

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
function defaultSpacerBlock(): SpacerBlock {
  return { id: newId(), kind: "spacer", height: 24 };
}
function defaultSocialBlock(): SocialBlock {
  const links: Record<string, string> = {};
  for (const n of SOCIAL_NETWORKS) links[n.key] = "";
  return { id: newId(), kind: "social", align: "center", links };
}
function defaultColumnsBlock(): ColumnsBlock {
  return {
    id: newId(),
    kind: "columns",
    leftWidth: 33,
    divider: true,
    left: [defaultImageBlock("https://app.myplv.be/logo-myplv.png", 100, "center")],
    right: [
      defaultTextBlock(
        '<p style="font-weight:700;font-size:15px;">Prénom Nom</p><p style="font-size:12px;color:#7b8494;">Fonction — Entreprise</p>',
        "left",
      ),
    ],
  };
}

/** Contenu de départ pour un nouveau template : logo MYPLV, une zone de texte, une zone image, un pied de page. */
export function starterBlocks(): Block[] {
  return [
    defaultImageBlock("https://app.myplv.be/logo-myplv.png", 250, "center"),
    defaultTextBlock("<p>Bonjour {{prenom}},</p><p>Votre contenu ici…</p><p>{{offre}}</p>", "left"),
    defaultImageBlock("https://placehold.co/560x260/eef1f6/7b8494?text=Image", null, "center"),
    defaultImageBlock("https://app.myplv.be/logo-myplv.png", 120, "center"),
    defaultTextBlock('<p style="font-size:12px;color:#7b8494;">MYPLV — Wavre, Belgique</p>', "center", "footer"),
  ];
}

export function starterHtml(): string {
  return blocksToHtml(starterBlocks());
}

/**
 * Mises en page proposées pour la signature email globale (écran Signature)
 * — un point de départ à personnaliser, pas un carcan : une fois appliquée,
 * la mise en page se modifie comme n'importe quel template (glisser-déposer,
 * ajout/suppression de blocs…). Les coordonnées sont volontairement des
 * placeholders génériques (pas de vraies données MYPLV en dur).
 */
export type SignatureLayout = { id: string; name: string; description: string; icon: string; makeBlocks: () => Block[] };

export function signatureLayouts(): SignatureLayout[] {
  return [
    {
      id: "minimal",
      name: "Minimaliste",
      description: "Nom, fonction et coordonnées — texte seul, sans image.",
      icon: "Aa",
      makeBlocks: () => [
        defaultTextBlock(
          "<p><strong>Prénom Nom</strong><br>Fonction — MYPLV</p><p>+32 000 00 00 00 · prenom.nom@myplv.be · myplv.be</p>",
          "left",
          "footer",
        ),
      ],
    },
    {
      id: "logo",
      name: "Avec logo",
      description: "Logo centré, séparateur, puis coordonnées.",
      icon: "🖼",
      makeBlocks: () => [
        defaultImageBlock("https://app.myplv.be/logo-myplv.png", 140, "center"),
        defaultDividerBlock(),
        defaultTextBlock(
          "<p style=\"text-align:center;\"><strong>Prénom Nom</strong><br>Fonction — MYPLV</p><p style=\"text-align:center;\">+32 000 00 00 00 · prenom.nom@myplv.be</p>",
          "center",
          "footer",
        ),
      ],
    },
    {
      id: "social",
      name: "Réseaux sociaux",
      description: "Coordonnées à gauche, icônes réseaux sociaux en dessous.",
      icon: "🔗",
      makeBlocks: () => [
        defaultTextBlock(
          "<p><strong>Prénom Nom</strong><br>Fonction — MYPLV</p><p>+32 000 00 00 00 · prenom.nom@myplv.be</p>",
          "left",
          "footer",
        ),
        defaultSocialBlock(),
      ],
    },
    {
      id: "cta",
      name: "Bandeau avec bouton",
      description: "Coordonnées + un bouton (rendez-vous, offres…) — un menu simple.",
      icon: "🔘",
      makeBlocks: () => [
        defaultTextBlock(
          "<p><strong>Prénom Nom</strong><br>Fonction — MYPLV</p><p>+32 000 00 00 00 · prenom.nom@myplv.be</p>",
          "left",
          "footer",
        ),
        { id: newId(), kind: "button", label: "Prendre rendez-vous", href: "https://myplv.be", align: "left", bg: "#14151a", color: "#ffffff" },
      ],
    },
    {
      id: "complete",
      name: "Complète",
      description: "Logo, coordonnées, bouton et réseaux sociaux — la plus riche.",
      icon: "✨",
      makeBlocks: () => [
        defaultImageBlock("https://app.myplv.be/logo-myplv.png", 140, "left"),
        defaultTextBlock(
          "<p><strong>Prénom Nom</strong><br>Fonction — MYPLV</p><p>+32 000 00 00 00 · prenom.nom@myplv.be · myplv.be</p>",
          "left",
          "footer",
        ),
        { id: newId(), kind: "button", label: "Découvrir nos offres", href: "https://myplv.be", align: "left", bg: "#14151a", color: "#ffffff" },
        defaultDividerBlock(),
        defaultSocialBlock(),
      ],
    },
    {
      id: "two-columns",
      name: "Deux colonnes",
      description: "Logo à gauche, séparateur vertical, nom et coordonnées à droite — signature classique en colonnes.",
      icon: "▥",
      makeBlocks: () => [
        {
          id: newId(),
          kind: "columns",
          leftWidth: 33,
          divider: true,
          left: [defaultImageBlock("https://app.myplv.be/logo-myplv.png", 100, "center")],
          right: [
            defaultTextBlock(
              '<p style="font-weight:700;font-size:15px;letter-spacing:0.02em;">Prénom Nom</p><p style="font-size:12px;color:#7b8494;letter-spacing:0.03em;text-transform:uppercase;">Fonction — Entreprise</p><p style="font-size:12.5px;">📞 +32 000 00 00 00</p><p style="font-size:12.5px;">🌐 www.myplv.be</p>',
              "left",
            ),
          ],
        },
      ],
    },
  ];
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
      const style = b.width
        ? `width:${b.width}px;height:auto;max-width:100%;display:inline-block;`
        : `max-width:min(${AUTO_IMAGE_MAX}px,100%);height:auto;display:inline-block;`;
      const img = `<img src="${b.src}" alt=""${widthAttr} style="${style}" />`;
      const linked = b.href ? `<a href="${b.href}" target="_blank" rel="noopener noreferrer">${img}</a>` : img;
      // "align" (attribut HTML) ET "text-align" (style inline) portent la
      // même valeur : l'attribut suffit dans la plupart des clients email,
      // mais un style inline gagne toujours face à une éventuelle feuille
      // de style externe qui ciblerait <td> — c'est justement ce qui
      // cassait le centrage dans notre propre aperçu en direct (nos
      // tableaux de données ont une règle globale `td { text-align:left }`
      // qui s'appliquait aussi, par erreur, à ce HTML injecté).
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;"><tr><td align="${alignStyle(b.align)}" style="text-align:${alignStyle(b.align)};">${linked}</td></tr></table>`;
    }
    case "button":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;"><tr><td align="${alignStyle(b.align)}" style="text-align:${alignStyle(b.align)};"><a href="${b.href}" style="background:${b.bg};color:${b.color};padding:12px 28px;border-radius:2px;display:inline-block;text-decoration:none;font-weight:600;font-family:Arial,Helvetica,sans-serif;">${b.label}</a></td></tr></table>`;
    case "divider":
      return `<hr style="border:none;border-top:1px solid #D8DCD3;margin:0;" />`;
    case "spacer":
      // line-height + &nbsp; plutôt qu'un <div> vide : certains clients
      // email (Outlook) réduisent la hauteur d'un bloc sans contenu.
      return `<div style="height:${b.height}px;line-height:${b.height}px;font-size:1px;">&nbsp;</div>`;
    case "social": {
      const icons = SOCIAL_NETWORKS.filter((n) => b.links[n.key]?.trim())
        .map(
          (n) =>
            `<a href="${b.links[n.key]}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 5px;"><img src="${socialIconDataUri(n.label, n.bg)}" width="32" height="32" alt="${n.name}" style="display:block;border-radius:50%;" /></a>`,
        )
        .join("");
      if (!icons) return "";
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;"><tr><td align="${alignStyle(b.align)}" style="text-align:${alignStyle(b.align)};">${icons}</td></tr></table>`;
    }
    case "columns": {
      // Motif email standard pour un côte-à-côte fiable (y compris Outlook,
      // qui ignore flex/grid) : deux <td> d'une même table, largeurs en %.
      // valign="middle" pour que logo (souvent plus bas que le texte) et
      // coordonnées restent alignés verticalement l'un sur l'autre.
      const leftHtml = b.left.map(blockBodyHtml).join("");
      const rightHtml = b.right.map(blockBodyHtml).join("");
      const rightWidth = 100 - b.leftWidth;
      const dividerStyle = b.divider ? "border-left:1px solid #D8DCD3;" : "";
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;"><tr>
<td width="${b.leftWidth}%" valign="middle" style="padding:0 16px 0 0;">${leftHtml}</td>
<td width="${rightWidth}%" valign="middle" style="padding:0 0 0 16px;${dividerStyle}">${rightHtml}</td>
</tr></table>`;
    }
  }
}

/**
 * Version JSON à plat d'un bloc (kind + sa config + son HTML pour un bloc
 * texte) — utilisée pour les enfants d'un bloc "columns". Contrairement au
 * niveau racine, ces enfants ne sont PAS sérialisés via des marqueurs
 * `<!--myplv:block:…-->` imbriqués : BLOCK_RE (non récursif) s'arrêterait
 * au premier marqueur de fermeture rencontré, celui d'un enfant, pas celui
 * du bloc "columns" englobant. La config JSON du bloc "columns" embarque
 * donc directement ce tableau de blocs enfants, reconstruit tel quel au
 * chargement (voir columnsFromConfig / blockFromConfig).
 */
function childToPlainConfig(b: Block): Record<string, unknown> {
  return { kind: b.kind, ...blockConfig(b), html: b.kind === "text" ? b.html : undefined };
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
    case "spacer":
      return { height: b.height };
    case "social":
      return { align: b.align, links: b.links };
    case "columns":
      return {
        leftWidth: b.leftWidth,
        divider: b.divider,
        left: b.left.map(childToPlainConfig),
        right: b.right.map(childToPlainConfig),
      };
  }
}

function blockToHtml(b: Block): string {
  const meta = JSON.stringify(blockConfig(b));
  const inner = b.kind === "text" ? b.html : "";
  return `<!--myplv:block:${b.kind}:${meta}-->${inner ? `<!--myplv:html:${btoa(unescape(encodeURIComponent(inner)))}-->` : ""}${blockBodyHtml(b)}<!--/myplv:block-->`;
}

/** Largeur de colonne standard d'un email — voir EMAIL_WIDTH plus haut. */
export function blocksToHtml(blocks: Block[]): string {
  const inner = blocks.map((b) => `${blockToHtml(b)}<p>&nbsp;</p>`).join("\n");
  // Sans ce cadre, chaque bloc (table width="100%") se met à la largeur du
  // corps de l'email — variable et souvent bien plus large que 600px selon
  // le client (Outlook, Gmail grand écran…). Résultat observé : une image
  // "Auto" (plafonnée à une largeur fixe en px) se retrouve centrée dans
  // une colonne beaucoup plus large que le texte à côté, donc visuellement
  // désaxée par rapport à lui — alors que dans notre propre aperçu (déjà
  // capé à 600px par son propre CSS), tout semblait correctement centré.
  // Le correctif : le motif email standard table 100% → <td align=center>
  // → table width=600 fixe, qui garantit la même colonne partout, y
  // compris dans Outlook (qui ignore max-width sur un <div>).
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf8;"><tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="${EMAIL_WIDTH}" cellpadding="0" cellspacing="0" style="width:${EMAIL_WIDTH}px;max-width:${EMAIL_WIDTH}px;background:#ffffff;">
<tr><td style="padding:24px;">
${inner}
</td></tr>
</table>
</td></tr></table>`;
}

const BLOCK_RE = /<!--myplv:block:(\w+):([\s\S]*?)-->(?:<!--myplv:html:([\s\S]*?)-->)?[\s\S]*?<!--\/myplv:block-->/g;

/**
 * Reconstruit un bloc (texte/image/bouton/séparateur/espaceur/réseaux
 * sociaux — pas "columns", voir columnsFromConfig) à partir de son kind, sa
 * config JSON et son HTML (pour un bloc texte). Partagé par htmlToBlocks
 * (marqueurs HTML au niveau racine) et columnsFromConfig (enfants d'un
 * bloc "columns", stockés en JSON à plat — voir childToPlainConfig) : même
 * logique de reconstruction, deux sources de données différentes.
 */
function blockFromConfig(kind: string, cfg: Record<string, unknown>, textHtml: string): Block | null {
  switch (kind) {
    case "text":
      return {
        id: newId(),
        kind: "text",
        html: textHtml || "<p></p>",
        align: (cfg.align as Align) || "left",
        role: cfg.role === "footer" ? "footer" : undefined,
      };
    case "image":
      return {
        id: newId(),
        kind: "image",
        src: (cfg.src as string) || "",
        width: (cfg.width as number) ?? null,
        align: (cfg.align as Align) || "center",
        href: (cfg.href as string) || "",
      };
    case "button":
      return {
        id: newId(),
        kind: "button",
        label: (cfg.label as string) || "En savoir plus",
        href: (cfg.href as string) || "",
        align: (cfg.align as Align) || "center",
        bg: (cfg.bg as string) || "#14151a",
        color: (cfg.color as string) || "#ffffff",
      };
    case "divider":
      return { id: newId(), kind: "divider" };
    case "spacer":
      return { id: newId(), kind: "spacer", height: (cfg.height as number) || 24 };
    case "social": {
      const links: Record<string, string> = {};
      const cfgLinks = (cfg.links as Record<string, string>) || {};
      for (const n of SOCIAL_NETWORKS) links[n.key] = cfgLinks[n.key] || "";
      return { id: newId(), kind: "social", align: (cfg.align as Align) || "center", links };
    }
    default:
      return null; // "columns" (imbriqué — non supporté) ou kind inconnu
  }
}

function columnsFromConfig(cfg: Record<string, unknown>): ColumnsBlock {
  const parseSide = (arr: unknown): Block[] =>
    Array.isArray(arr)
      ? (arr as Record<string, unknown>[])
          .map((p) => blockFromConfig(p.kind as string, p, (p.html as string) || ""))
          .filter((b): b is Block => b !== null)
      : [];
  return {
    id: newId(),
    kind: "columns",
    leftWidth: typeof cfg.leftWidth === "number" ? cfg.leftWidth : 33,
    divider: cfg.divider !== false,
    left: parseSide(cfg.left),
    right: parseSide(cfg.right),
  };
}

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
    if (kind === "columns") {
      blocks.push(columnsFromConfig(cfg));
    } else {
      const b = blockFromConfig(kind, cfg, textHtml);
      if (b) blocks.push(b);
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
  if (b.kind === "spacer") return "Espaceur";
  if (b.kind === "social") return "Réseaux sociaux";
  if (b.kind === "columns") return "Colonnes";
  return "Séparateur";
}

/** Kinds autorisés dans une colonne — pas "columns" (pas de colonnes imbriquées, pour rester lisible) ni "divider"/"spacer" (peu utiles côte à côte, un séparateur vertical existe déjà entre les deux colonnes). */
const COLUMN_CHILD_PALETTE: { kind: Exclude<Block["kind"], "columns" | "divider" | "spacer">; icon: string; label: string }[] = [
  { kind: "text", icon: "📝", label: "Texte" },
  { kind: "image", icon: "🖼", label: "Image" },
  { kind: "button", icon: "🔘", label: "Bouton" },
  { kind: "social", icon: "🌐", label: "Réseaux sociaux" },
];

/** Palette de blocs affichée dans la boîte à outils latérale. */
const BLOCK_PALETTE: { kind: Block["kind"]; icon: string; label: string }[] = [
  { kind: "text", icon: "📝", label: "Texte" },
  { kind: "image", icon: "🖼", label: "Image" },
  { kind: "button", icon: "🔘", label: "Bouton" },
  { kind: "social", icon: "🌐", label: "Réseaux sociaux" },
  { kind: "columns", icon: "▥", label: "Colonnes" },
  { kind: "divider", icon: "➖", label: "Séparateur" },
  { kind: "spacer", icon: "↕", label: "Espaceur" },
];

type DropPos = "before" | "after";

function BlockChrome({
  id,
  label,
  dragging,
  dropIndicator,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onHeadPointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
  registerRef,
  onDelete,
  onSaveSnippet,
  extra,
  children,
}: {
  id: string;
  label: string;
  dragging: boolean;
  dropIndicator: DropPos | null;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onHeadPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onHandlePointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onHandlePointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  onDelete: () => void;
  onSaveSnippet: () => void;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div ref={(el) => registerRef(id, el)} className={`email-block ${dragging ? "is-dragging" : ""} ${dropIndicator ? `drop-${dropIndicator}` : ""}`}>
      {/* Pointer Events + setPointerCapture plutôt que le drag-and-drop HTML5
          natif : ce dernier repose sur le protocole de drag de l'OS et se
          montre capricieux selon souris/trackpad. La capture de pointeur
          garde tous les événements sur cette barre même quand le curseur
          sort de ses limites — fiable partout. Toute la barre-titre est
          la zone de glisser (pas seulement l'icône ⠿) pour une cible plus
          confortable ; les boutons (↑ ↓ 💾 ✕) sont exclus dans le handler
          pour garder leur clic normal. Les flèches ↑ / ↓ restent un moyen
          de réordonner sans glisser du tout. */}
      <div className="email-block-head" style={{ touchAction: "none" }} onPointerDown={onHeadPointerDown} onPointerMove={onHandlePointerMove} onPointerUp={onHandlePointerUp} onPointerCancel={onHandlePointerUp}>
        <span className="block-drag-handle" title="Glisser pour réordonner" aria-hidden="true">
          ⠿
        </span>
        <button type="button" className="icon-btn" title="Monter" disabled={isFirst} onClick={onMoveUp}>
          ↑
        </button>
        <button type="button" className="icon-btn" title="Descendre" disabled={isLast} onClick={onMoveDown}>
          ↓
        </button>
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
  const imgRefs = useRef<Map<string, HTMLImageElement>>(new Map());
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

  // Glisser-déposer : id du bloc existant en cours de déplacement (réordre)
  // OU paletteDragging quand c'est un nouveau bloc glissé depuis la barre
  // latérale (palette / blocs enregistrés) — dans les deux cas, overId/overPos
  // indiquent le bloc survolé et la position (avant/après) pour l'indicateur
  // visuel. blockElRefs donne accès aux positions de tous les blocs pendant
  // le déplacement du pointeur (nécessaire puisque tous les événements sont
  // capturés sur le seul élément en cours de glissement, pas sur les blocs
  // survolés).
  const [dragId, setDragId] = useState<string | null>(null);
  const [paletteDragging, setPaletteDragging] = useState(false);
  const [overId, setOverId] = useState<string | null>(null);
  const [overPos, setOverPos] = useState<DropPos | null>(null);
  const blockElRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Fabrique du bloc à insérer, posée au pointerdown sur un item de la
  // palette / bibliothèque, lue au drop — évite de stocker le bloc en state
  // React (inutile avant qu'on sache si on glisse vraiment, voir seuil plus
  // bas) et contourne le problème de closure obsolète (l'état React mis à
  // jour par setPaletteDragging n'est pas encore visible dans le même
  // gestionnaire d'événement).
  const paletteDragRef = useRef<{ makeBlock: () => Block; startX: number; startY: number; dragging: boolean } | null>(null);
  // Voir handlePaletteDragEnd : un clic natif suit un glisser réel à cause
  // de la redirection des événements de compatibilité par la capture de
  // pointeur — ce drapeau permet aux onClick des cartes de l'ignorer une
  // fois pour éviter un double ajout.
  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    if (!dragId && !paletteDragging) return;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = prevUserSelect;
    };
  }, [dragId, paletteDragging]);

  // Blocs réutilisables et mises en page enregistrées (localStorage).
  const [snippets, setSnippets] = useState<Snippet[]>(() => readLocal(SNIPPETS_KEY, [] as Snippet[]));
  const [layouts, setLayouts] = useState<SavedLayout[]>(() => readLocal(LAYOUTS_KEY, [] as SavedLayout[]));
  const [showLayouts, setShowLayouts] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Aperçu en direct : le HTML courant (blocs ou source brute selon le
  // mode), avec les variables {{prenom}}… remplacées par des exemples —
  // mêmes données que l'aperçu serveur (écran Templates) et l'envoi de
  // test, pour ne jamais surprendre entre les deux.
  const previewHtml = renderTemplate(rawMode ? rawText : blocksToHtml(blocks), SAMPLE_VARIABLES);

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

  // updateBlock/deleteBlock descendent aussi dans les colonnes d'un bloc
  // "columns" : un enfant de colonne a le même id unique qu'un bloc racine
  // (newId()), donc tous les éditeurs par kind (texte/image/bouton…) déjà
  // écrits pour les blocs racine fonctionnent tels quels pour les enfants
  // de colonne — un seul id à connaître, peu importe sa profondeur.
  function updateAnyBlock(list: Block[], id: string, patch: Partial<Block>): Block[] {
    return list.map((b) => {
      if (b.id === id) return { ...b, ...patch } as Block;
      if (b.kind === "columns") return { ...b, left: updateAnyBlock(b.left, id, patch), right: updateAnyBlock(b.right, id, patch) };
      return b;
    });
  }

  function deleteAnyBlock(list: Block[], id: string): Block[] {
    return list
      .filter((b) => b.id !== id)
      .map((b) => (b.kind === "columns" ? { ...b, left: deleteAnyBlock(b.left, id), right: deleteAnyBlock(b.right, id) } : b));
  }

  function updateBlock(id: string, patch: Partial<Block>) {
    commit(updateAnyBlock(blocks, id, patch));
  }

  function deleteBlock(id: string) {
    initialHtmlRef.current.delete(id);
    textRefs.current.delete(id);
    imgRefs.current.delete(id);
    blockElRefs.current.delete(id);
    commit(deleteAnyBlock(blocks, id));
  }

  function moveBlock(id: string, dir: -1 | 1) {
    const idx = blocks.findIndex((b) => b.id === id);
    const swapWith = idx + dir;
    if (idx < 0 || swapWith < 0 || swapWith >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    commit(next);
  }

  function makeBlockForKind(kind: Block["kind"]): Block {
    switch (kind) {
      case "text":
        return defaultTextBlock();
      case "image":
        return defaultImageBlock("https://placehold.co/560x260/eef1f6/7b8494?text=Image");
      case "button":
        return defaultButtonBlock();
      case "spacer":
        return defaultSpacerBlock();
      case "social":
        return defaultSocialBlock();
      case "divider":
        return defaultDividerBlock();
      case "columns":
        return defaultColumnsBlock();
    }
  }

  function addBlock(kind: Block["kind"]) {
    commit([...blocks, makeBlockForKind(kind)]);
  }

  /** Ajoute un bloc dans une colonne (gauche/droite) d'un bloc "columns" existant. */
  function addColumnChild(parentId: string, side: "left" | "right", kind: Block["kind"]) {
    if (kind === "columns") return; // pas de colonnes imbriquées
    commit(
      blocks.map((b) => (b.id === parentId && b.kind === "columns" ? { ...b, [side]: [...b[side], makeBlockForKind(kind)] } : b)),
    );
  }

  /** Réordonne un enfant à l'intérieur d'une seule colonne (haut/bas — pas de glisser ici, une colonne de signature compte rarement plus de 2-3 éléments). */
  function moveColumnChild(parentId: string, side: "left" | "right", id: string, dir: -1 | 1) {
    commit(
      blocks.map((b) => {
        if (b.id !== parentId || b.kind !== "columns") return b;
        const list = [...b[side]];
        const idx = list.findIndex((c) => c.id === id);
        const swapWith = idx + dir;
        if (idx < 0 || swapWith < 0 || swapWith >= list.length) return b;
        [list[idx], list[swapWith]] = [list[swapWith], list[idx]];
        return { ...b, [side]: list };
      }),
    );
  }

  /**
   * Édition compacte d'un bloc enfant à l'intérieur d'une colonne — même
   * champs que l'éditeur de bloc racine (texte riche, image, bouton,
   * réseaux sociaux) mais sans BlockChrome (pas de glisser-déposer à ce
   * niveau, une colonne de signature compte rarement plus de 2-3 éléments —
   * ↑ ↓ suffisent). textRefs/imgRefs/getInitialHtml/handleTextInput/
   * updateBlock sont partagés avec les blocs racine : ils sont indexés par
   * id de bloc, pas par position, donc fonctionnent à l'identique ici.
   */
  function renderColumnChild(parent: ColumnsBlock, side: "left" | "right", child: Block) {
    const sideList = parent[side];
    const idx = sideList.findIndex((c) => c.id === child.id);
    const isFirst = idx === 0;
    const isLast = idx === sideList.length - 1;

    let body: React.ReactNode = null;
    if (child.kind === "text") {
      body = (
        <div
          ref={(el) => {
            if (el) textRefs.current.set(child.id, el);
            else textRefs.current.delete(child.id);
          }}
          className="rich-editor-surface email-block-text"
          style={{ textAlign: child.align, fontSize: 13 }}
          contentEditable
          suppressContentEditableWarning
          onInput={() => handleTextInput(child.id)}
          onBlur={() => handleTextInput(child.id)}
          dangerouslySetInnerHTML={{ __html: getInitialHtml(child.id, child.html) }}
        />
      );
    } else if (child.kind === "image") {
      body =
        imagePanelFor === child.id ? (
          <ImagePicker
            label="Remplacer par :"
            onCancel={() => setImagePanelFor(null)}
            onPick={(src) => {
              updateBlock(child.id, { src } as Partial<ImageBlock>);
              setImagePanelFor(null);
            }}
          />
        ) : (
          <>
            <div className="email-block-image-preview" style={{ justifyContent: alignStyle(child.align) as "left" | "center" | "right" }}>
              {child.src ? (
                <img
                  ref={(el) => {
                    if (el) imgRefs.current.set(child.id, el);
                    else imgRefs.current.delete(child.id);
                  }}
                  src={child.src}
                  alt=""
                  style={child.width ? { width: child.width, height: "auto", maxWidth: "100%" } : { maxWidth: `min(${AUTO_IMAGE_MAX}px, 100%)`, height: "auto" }}
                />
              ) : (
                <span className="empty-state">Aucune image</span>
              )}
            </div>
            <div className="email-block-controls">
              <button type="button" className="btn" onClick={() => setImagePanelFor(child.id)}>
                Changer l'image
              </button>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                Largeur
                <input
                  type="number"
                  min={10}
                  placeholder="auto"
                  value={child.width ?? ""}
                  onChange={(e) => updateBlock(child.id, { width: e.target.value ? Number(e.target.value) : null } as Partial<ImageBlock>)}
                  style={{ width: 64 }}
                />
                px
              </label>
            </div>
          </>
        );
    } else if (child.kind === "button") {
      body = (
        <div className="email-block-controls" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Texte
            <input type="text" value={child.label} onChange={(e) => updateBlock(child.id, { label: e.target.value } as Partial<ButtonBlock>)} style={{ flex: 1 }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Lien
            <input
              type="text"
              placeholder="https://…"
              value={child.href}
              onChange={(e) => updateBlock(child.id, { href: e.target.value } as Partial<ButtonBlock>)}
              style={{ flex: 1 }}
            />
          </label>
        </div>
      );
    } else if (child.kind === "social") {
      body = (
        <div className="email-block-controls" style={{ flexDirection: "column", alignItems: "stretch" }}>
          {SOCIAL_NETWORKS.map((n) => (
            <label key={n.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 80, flexShrink: 0, fontSize: 11.5, color: "var(--ink-soft)" }}>{n.name}</span>
              <input
                type="text"
                placeholder={n.placeholder}
                value={child.links[n.key] || ""}
                onChange={(e) => updateBlock(child.id, { links: { ...child.links, [n.key]: e.target.value } } as Partial<SocialBlock>)}
                style={{ flex: 1 }}
              />
            </label>
          ))}
        </div>
      );
    }

    return (
      <div className="column-child" key={child.id}>
        <div className="column-child-head">
          <span className="email-block-label">{labelFor(child)}</span>
          <span className="email-block-spacer" />
          <button type="button" className="icon-btn" title="Monter" disabled={isFirst} onClick={() => moveColumnChild(parent.id, side, child.id, -1)}>
            ↑
          </button>
          <button type="button" className="icon-btn" title="Descendre" disabled={isLast} onClick={() => moveColumnChild(parent.id, side, child.id, 1)}>
            ↓
          </button>
          <button type="button" className="icon-btn danger" title="Supprimer" onClick={() => deleteBlock(child.id)}>
            ✕
          </button>
        </div>
        <div className="column-child-body">{body}</div>
      </div>
    );
  }

  /** Insère `block` à l'emplacement visé par le glisser en cours (overId/overPos), ou en fin de liste si aucun bloc n'est survolé. */
  function insertAtDropTarget(block: Block) {
    const next = [...blocks];
    const idx = overId ? next.findIndex((b) => b.id === overId) : -1;
    if (idx < 0) {
      next.push(block);
    } else {
      next.splice(overPos === "after" ? idx + 1 : idx, 0, block);
    }
    commit(next);
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

  function registerBlockRef(id: string, el: HTMLDivElement | null) {
    if (el) blockElRefs.current.set(id, el);
    else blockElRefs.current.delete(id);
  }

  /** Calcule, à partir de la position Y du pointeur, le bloc survolé et s'il faut s'insérer avant ou après lui — partagé par le réordre et le glisser depuis la palette. */
  function updateDropTarget(y: number, excludeId?: string | null) {
    let bestId: string | null = null;
    let bestPos: DropPos = "before";
    let bestDist = Infinity;
    for (const [id, el] of blockElRefs.current) {
      if (id === excludeId) continue;
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) {
        bestId = id;
        bestPos = y - rect.top > rect.height / 2 ? "after" : "before";
        bestDist = 0;
        break;
      }
      const centerDist = Math.abs(y - (rect.top + rect.bottom) / 2);
      if (centerDist < bestDist) {
        bestDist = centerDist;
        bestId = id;
        bestPos = y < rect.top ? "before" : "after";
      }
    }
    if (bestId) {
      setOverId(bestId);
      setOverPos(bestPos);
    }
  }

  // --- Réordre d'un bloc existant (poignée + barre-titre du bloc) ---

  function handleHeadPointerDown(e: React.PointerEvent<HTMLDivElement>, blockId: string) {
    // Les boutons (↑ ↓ 💾 ✕) gardent leur clic normal — seule la barre
    // elle-même (poignée, libellé, zone vide) déclenche un glisser.
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragId(blockId);
  }

  function handleHandlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragId) return;
    updateDropTarget(e.clientY, dragId);
  }

  function handleHandlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (dragId && overId && dragId !== overId) {
      const fromIdx = blocks.findIndex((b) => b.id === dragId);
      const toIdx = blocks.findIndex((b) => b.id === overId);
      if (fromIdx >= 0 && toIdx >= 0) {
        const next = [...blocks];
        const [moved] = next.splice(fromIdx, 1);
        let insertAt = next.findIndex((b) => b.id === overId);
        if (overPos === "after") insertAt += 1;
        next.splice(insertAt, 0, moved);
        commit(next);
      }
    }
    resetDrag();
  }

  // --- Glisser un nouveau bloc depuis la palette / bibliothèque ---
  // Un simple clic doit continuer à ajouter en fin de liste (comportement
  // existant) : on ne bascule en "glisser" qu'après un déplacement réel du
  // pointeur (seuil de 6px), pour ne jamais perturber onClick.

  function handlePaletteDragStart(e: React.PointerEvent<HTMLButtonElement>, makeBlock: () => Block) {
    e.currentTarget.setPointerCapture(e.pointerId);
    paletteDragRef.current = { makeBlock, startX: e.clientX, startY: e.clientY, dragging: false };
  }

  function handlePaletteDragMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = paletteDragRef.current;
    if (!drag) return;
    if (!drag.dragging) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
      drag.dragging = true;
      setPaletteDragging(true);
    }
    updateDropTarget(e.clientY);
  }

  function handlePaletteDragEnd(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const drag = paletteDragRef.current;
    paletteDragRef.current = null;
    if (drag?.dragging) {
      insertAtDropTarget(drag.makeBlock());
      // La capture de pointeur redirige aussi l'événement "mouseup" de
      // compatibilité vers ce bouton (même si le pointeur a physiquement
      // fini ailleurs), donc un clic natif se déclenche quand même juste
      // après — on l'ignore une fois pour ne pas ajouter le bloc une
      // seconde fois en fin de liste.
      suppressNextClickRef.current = true;
      setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 0);
    }
    resetDrag();
    // Si aucun glisser réel n'a eu lieu (drag est resté falsy), on laisse le
    // onClick natif du bouton gérer l'ajout simple en fin de liste.
  }

  function resetDrag() {
    setDragId(null);
    setPaletteDragging(false);
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

        <button type="button" className={`btn ${showPreview ? "btn-primary" : ""}`} style={{ marginLeft: "auto" }} onClick={() => setShowPreview((v) => !v)}>
          👁 Aperçu
        </button>
        <button type="button" className="btn" onClick={() => setShowLayouts(true)}>
          📐 Mes mises en page
        </button>
        <button type="button" className="btn" onClick={rawMode ? switchToVisual : switchToRaw}>
          {rawMode ? "Éditeur visuel" : "Voir le HTML"}
        </button>
      </div>

      <div className="rich-editor-columns">
        {!rawMode && (
          <div className="rich-editor-sidebar">
            <div className="rich-editor-sidebar-head">Ajouter un bloc</div>
            <div className="block-palette">
              {BLOCK_PALETTE.map((p) => (
                <button
                  key={p.kind}
                  type="button"
                  className="block-palette-card"
                  style={{ touchAction: "none" }}
                  onClick={() => {
                    if (suppressNextClickRef.current) return;
                    addBlock(p.kind);
                  }}
                  onPointerDown={(e) => handlePaletteDragStart(e, () => makeBlockForKind(p.kind))}
                  onPointerMove={handlePaletteDragMove}
                  onPointerUp={handlePaletteDragEnd}
                  onPointerCancel={handlePaletteDragEnd}
                >
                  <span className="block-palette-icon">{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
            <div className="rich-editor-sidebar-head">Mes blocs enregistrés</div>
            <div className="block-library-list">
              {snippets.length === 0 ? (
                <div className="block-library-empty">
                  Aucun bloc enregistré — utilise 💾 sur un bloc (ex. ton pied de page) pour pouvoir le réutiliser tel quel dans tes prochains templates.
                </div>
              ) : (
                snippets.map((s) => (
                  <div key={s.id} className="block-library-item">
                    <button
                      type="button"
                      className="name-btn"
                      style={{ touchAction: "none" }}
                      onClick={() => {
                        if (suppressNextClickRef.current) return;
                        insertSnippet(s);
                      }}
                      onPointerDown={(e) => handlePaletteDragStart(e, () => cloneWithNewId(s.block))}
                      onPointerMove={handlePaletteDragMove}
                      onPointerUp={handlePaletteDragEnd}
                      onPointerCancel={handlePaletteDragEnd}
                    >
                      {s.name}
                    </button>
                    <button type="button" className="icon-btn danger" title="Supprimer ce bloc enregistré" onClick={() => deleteSnippet(s.id)}>
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="rich-editor-left">
      {rawMode ? (
        <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={14} className="rich-editor-raw" />
      ) : (
        <div className="email-blocks">
          {blocks.length === 0 && <div className="empty-state">Aucun bloc — ajoute-en un ci-dessous.</div>}
          {blocks.map((b, i) => {
            const common = {
              id: b.id,
              label: labelFor(b),
              dragging: dragId === b.id,
              dropIndicator: (dragId || paletteDragging) && overId === b.id && dragId !== b.id ? overPos : null,
              isFirst: i === 0,
              isLast: i === blocks.length - 1,
              onMoveUp: () => moveBlock(b.id, -1),
              onMoveDown: () => moveBlock(b.id, 1),
              onHeadPointerDown: (e: React.PointerEvent<HTMLDivElement>) => handleHeadPointerDown(e, b.id),
              onHandlePointerMove: handleHandlePointerMove,
              onHandlePointerUp: handleHandlePointerUp,
              registerRef: registerBlockRef,
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
                      {b.src ? (
                        <img
                          ref={(el) => {
                            if (el) imgRefs.current.set(b.id, el);
                            else imgRefs.current.delete(b.id);
                          }}
                          src={b.src}
                          alt=""
                          style={b.width ? { width: b.width, height: "auto", maxWidth: "100%" } : { maxWidth: `min(${AUTO_IMAGE_MAX}px, 100%)`, height: "auto" }}
                        />
                      ) : (
                        <span className="empty-state">Aucune image</span>
                      )}
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
                    <button
                      type="button"
                      className={`btn ${b.width === null ? "btn-primary" : ""}`}
                      title="S'adapte à l'écran, sans dépasser sa taille naturelle"
                      onClick={() => updateBlock(b.id, { width: null } as Partial<ImageBlock>)}
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      className="btn"
                      title="Revenir à la taille native du fichier"
                      onClick={() => {
                        const natural = imgRefs.current.get(b.id)?.naturalWidth;
                        updateBlock(b.id, { width: natural && natural > 0 ? natural : null } as Partial<ImageBlock>);
                      }}
                    >
                      Original
                    </button>
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
            if (b.kind === "spacer") {
              return (
                <BlockChrome key={b.id} {...common}>
                  <div className="email-block-controls">
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      Hauteur
                      <input
                        type="number"
                        min={4}
                        max={200}
                        value={b.height}
                        onChange={(e) => updateBlock(b.id, { height: Number(e.target.value) || 0 } as Partial<SpacerBlock>)}
                        style={{ width: 72 }}
                      />
                      px
                    </label>
                  </div>
                  <div className="spacer-preview" style={{ height: Math.min(Math.max(b.height, 4), 80) }} />
                </BlockChrome>
              );
            }
            if (b.kind === "social") {
              const active = SOCIAL_NETWORKS.filter((n) => b.links[n.key]?.trim());
              return (
                <BlockChrome key={b.id} {...common} extra={<AlignPicker value={b.align} onChange={(align) => updateBlock(b.id, { align })} />}>
                  <div className="email-block-controls" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    {SOCIAL_NETWORKS.map((n) => (
                      <label key={n.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 92, flexShrink: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>{n.name}</span>
                        <input
                          type="text"
                          placeholder={n.placeholder}
                          value={b.links[n.key] || ""}
                          onChange={(e) => updateBlock(b.id, { links: { ...b.links, [n.key]: e.target.value } } as Partial<SocialBlock>)}
                          style={{ flex: 1 }}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="email-block-image-preview" style={{ justifyContent: alignStyle(b.align) as "left" | "center" | "right" }}>
                    {active.length === 0 ? (
                      <span className="empty-state">Ajoute au moins une URL ci-dessus pour voir l'icône apparaître</span>
                    ) : (
                      active.map((n) => (
                        <span
                          key={n.key}
                          title={n.name}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: n.bg,
                            color: "#fff",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            marginRight: 6,
                          }}
                        >
                          {n.label}
                        </span>
                      ))
                    )}
                  </div>
                </BlockChrome>
              );
            }
            if (b.kind === "columns") {
              return (
                <BlockChrome
                  key={b.id}
                  {...common}
                  extra={
                    <span className="block-align-picker">
                      <select
                        className="columns-width-select"
                        title="Largeur de la colonne de gauche"
                        value={b.leftWidth}
                        onChange={(e) => updateBlock(b.id, { leftWidth: Number(e.target.value) } as Partial<ColumnsBlock>)}
                      >
                        <option value={25}>25 / 75</option>
                        <option value={33}>33 / 66</option>
                        <option value={50}>50 / 50</option>
                        <option value={66}>66 / 33</option>
                      </select>
                      <button
                        type="button"
                        className={`icon-btn ${b.divider ? "active" : ""}`}
                        title="Séparateur vertical entre les colonnes"
                        onClick={() => updateBlock(b.id, { divider: !b.divider } as Partial<ColumnsBlock>)}
                      >
                        │
                      </button>
                    </span>
                  }
                >
                  <div className="columns-block-editor">
                    {(["left", "right"] as const).map((side) => (
                      <div className="column-side" key={side}>
                        <div className="column-side-head">{side === "left" ? "Colonne gauche" : "Colonne droite"}</div>
                        {b[side].map((child) => renderColumnChild(b, side, child))}
                        <div className="column-side-add">
                          {COLUMN_CHILD_PALETTE.map((p) => (
                            <button key={p.kind} type="button" className="icon-btn" title={`Ajouter : ${p.label}`} onClick={() => addColumnChild(b.id, side, p.kind)}>
                              {p.icon}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
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
        </div>

        {showPreview && (
          <div className="rich-editor-preview">
            <div className="rich-editor-preview-head">Aperçu en direct</div>
            <div className="rich-editor-preview-body">
              <div className="rich-editor-preview-frame" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        )}
      </div>

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
