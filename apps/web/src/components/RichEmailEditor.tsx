import { useEffect, useRef, useState } from "react";

/**
 * Éditeur enrichi pour le corps des templates email — brief : styles de
 * texte, couleurs, police/corps, insertion d'images et de colonnes.
 *
 * Volontairement construit sans dépendance externe : chaque style est
 * appliqué en CSS inline directement sur la sélection (pas de classes),
 * seule forme fiable dans la plupart des clients email (Outlook, Gmail
 * strippent souvent les balises <style>). Les colonnes utilisent un
 * <table> — flexbox/grid ne sont pas fiables en email.
 */

const FONT_FAMILIES = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
];

const FONT_SIZES = [12, 13, 14, 16, 18, 20, 24, 28, 32];

function wrapSelectionWithStyle(styleProp: string, value: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  const span = document.createElement("span");
  span.style.setProperty(styleProp, value);
  try {
    const content = range.extractContents();
    span.appendChild(content);
    range.insertNode(span);
    // Repositionne la sélection sur le contenu modifié.
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(newRange);
    return true;
  } catch {
    return false;
  }
}

function toggleWrapStyle(styleProp: string, value: string) {
  // Bascule simple : applique le style. Pour retirer, l'utilisateur
  // resélectionne et choisit "Normal"/couleur par défaut — reste simple et
  // prévisible plutôt que de détecter finement l'état actuel.
  return wrapSelectionWithStyle(styleProp, value);
}

function insertHtmlAtCursor(editor: HTMLDivElement, html: string) {
  editor.focus();
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const fragment = range.createContextualFragment(html);
    const lastNode = fragment.lastChild;
    range.insertNode(fragment);
    if (lastNode) {
      const newRange = document.createRange();
      newRange.setStartAfter(lastNode);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
  } else {
    editor.insertAdjacentHTML("beforeend", html);
  }
}

function columnsTableHtml(count: 2 | 3): string {
  const width = Math.floor(100 / count);
  const cells = Array.from({ length: count })
    .map(
      (_, i) =>
        `<td width="${width}%" style="vertical-align:top;padding:${i === 0 ? "0 10px 0 0" : i === count - 1 ? "0 0 0 10px" : "0 10px"};">Colonne ${i + 1}</td>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;"><tr>${cells}</tr></table><p>&nbsp;</p>`;
}

/** Bloc "image + texte" côte à côte (table, portable email) — image à gauche ou à droite. */
function imageTextTableHtml(imageSrc: string, imageOnLeft: boolean): string {
  const imageCell = `<td width="40%" style="vertical-align:top;${imageOnLeft ? "padding:0 12px 0 0" : "padding:0 0 0 12px"};"><img src="${imageSrc}" alt="" style="max-width:100%;height:auto;display:block;" /></td>`;
  const textCell = `<td width="60%" style="vertical-align:top;${imageOnLeft ? "padding:0 0 0 12px" : "padding:0 12px 0 0"};">Votre texte ici…</td>`;
  const cells = imageOnLeft ? imageCell + textCell : textCell + imageCell;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;"><tr>${cells}</tr></table><p>&nbsp;</p>`;
}

export function RichEmailEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [rawMode, setRawMode] = useState(false);
  const [insertMode, setInsertMode] = useState<null | "image" | "imageTextLeft" | "imageTextRight">(null);
  const [imageUrl, setImageUrl] = useState("");
  // null tant qu'aucune synchronisation n'a eu lieu — garantit que le
  // premier rendu (montage, ou bascule retour depuis le mode HTML) peuple
  // bien le contentEditable avec "value", même si celle-ci n'a pas changé
  // depuis l'initialisation du composant.
  const lastValueRef = useRef<string | null>(null);

  // Ne réécrit le DOM que si "value" a changé depuis l'extérieur (ex.
  // sélection d'un autre template) — jamais à chaque frappe, pour ne pas
  // faire sauter le curseur.
  useEffect(() => {
    if (rawMode) return;
    if (editorRef.current && value !== lastValueRef.current) {
      editorRef.current.innerHTML = value;
    }
    lastValueRef.current = value;
  }, [value, rawMode]);

  function emitChange() {
    if (editorRef.current) {
      lastValueRef.current = editorRef.current.innerHTML;
      onChange(editorRef.current.innerHTML);
    }
  }

  function applyStyle(styleProp: string, val: string) {
    if (!editorRef.current) return;
    editorRef.current.focus();
    toggleWrapStyle(styleProp, val);
    emitChange();
  }

  function insertImageSrc(src: string) {
    if (!editorRef.current) return;
    editorRef.current.focus();
    if (insertMode === "imageTextLeft" || insertMode === "imageTextRight") {
      insertHtmlAtCursor(editorRef.current, imageTextTableHtml(src, insertMode === "imageTextLeft"));
    } else {
      insertHtmlAtCursor(editorRef.current, `<img src="${src}" alt="" style="max-width:100%;height:auto;" />`);
    }
    emitChange();
    setInsertMode(null);
    setImageUrl("");
  }

  function handleInsertImage(fromUrl: string) {
    if (!fromUrl.trim()) return;
    insertImageSrc(fromUrl.trim());
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") insertImageSrc(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleInsertColumns(count: 2 | 3) {
    if (!editorRef.current) return;
    editorRef.current.focus();
    insertHtmlAtCursor(editorRef.current, columnsTableHtml(count));
    emitChange();
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
          onMouseDown={(e) => e.preventDefault()}
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
          onMouseDown={(e) => e.preventDefault()}
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
          <input
            type="color"
            defaultValue="#1c2230"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => applyStyle("color", e.target.value)}
          />
        </label>

        <span className="rich-editor-sep" />

        <button
          type="button"
          className="btn"
          title="Insérer une image"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setInsertMode((v) => (v === "image" ? null : "image"))}
        >
          🖼 Image
        </button>
        <button
          type="button"
          className="btn"
          title="Image à gauche, texte à droite"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setInsertMode((v) => (v === "imageTextLeft" ? null : "imageTextLeft"))}
        >
          🖼|T Image + texte
        </button>
        <button
          type="button"
          className="btn"
          title="Texte à gauche, image à droite"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setInsertMode((v) => (v === "imageTextRight" ? null : "imageTextRight"))}
        >
          T|🖼
        </button>
        <button type="button" className="btn" title="2 colonnes de texte" onMouseDown={(e) => e.preventDefault()} onClick={() => handleInsertColumns(2)}>
          ⬛⬛
        </button>
        <button type="button" className="btn" title="3 colonnes de texte" onMouseDown={(e) => e.preventDefault()} onClick={() => handleInsertColumns(3)}>
          ⬛⬛⬛
        </button>

        <span className="rich-editor-sep" />

        <button type="button" className="btn" onClick={() => setRawMode((v) => !v)} style={{ marginLeft: "auto" }}>
          {rawMode ? "Éditeur visuel" : "Voir le HTML"}
        </button>
      </div>

      {insertMode && (
        <div className="rich-editor-image-panel">
          <input
            type="text"
            placeholder="https://…/image.png"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn-primary" onClick={() => handleInsertImage(imageUrl)}>
            Insérer l'URL
          </button>
          <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>ou</span>
          <label className="btn" style={{ cursor: "pointer" }}>
            Importer un fichier
            <input type="file" accept="image/*" onChange={handleFilePick} style={{ display: "none" }} />
          </label>
        </div>
      )}

      {rawMode ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={10}
          className="rich-editor-raw"
        />
      ) : (
        <div
          ref={editorRef}
          className="rich-editor-surface"
          contentEditable
          suppressContentEditableWarning
          onInput={emitChange}
          onBlur={emitChange}
        />
      )}
    </div>
  );
}
