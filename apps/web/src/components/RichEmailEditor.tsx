import { useEffect, useRef, useState } from "react";

/**
 * Éditeur enrichi pour le corps des templates email — brief : styles de
 * texte, couleurs, police/corps, insertion d'images (redimensionnables,
 * remplaçables) et de colonnes.
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

  // Les menus <select> (police/corps) et le sélecteur de couleur volent
  // nécessairement le focus au contentEditable pour ouvrir leur widget
  // natif — ce qui efface la sélection de texte en cours. On la sauvegarde
  // juste avant (mousedown) pour pouvoir la restaurer avant d'appliquer le
  // style (onChange).
  const savedRangeRef = useRef<Range | null>(null);
  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }

  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [imgWidth, setImgWidth] = useState("");
  const replaceTargetRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (rawMode) return;
    if (editorRef.current && value !== lastValueRef.current) {
      editorRef.current.innerHTML = value;
    }
    lastValueRef.current = value;
  }, [value, rawMode]);

  function emitChange() {
    if (!editorRef.current) return;
    // L'indicateur visuel "image sélectionnée" (classe CSS, purement pour
    // l'édition) ne doit jamais atterrir dans le HTML final envoyé par
    // email — nettoyé avant de remonter au parent.
    const cleaned = editorRef.current.innerHTML.replace(/\s*class="rich-img-selected"/g, "");
    lastValueRef.current = cleaned;
    onChange(cleaned);
  }

  function applyStyle(styleProp: string, val: string) {
    if (!editorRef.current) return;
    editorRef.current.focus();
    let sel = window.getSelection();
    const hasLiveSelection = !!sel && sel.rangeCount > 0 && !sel.isCollapsed && editorRef.current.contains(sel.anchorNode);
    if (!hasLiveSelection && savedRangeRef.current) {
      sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRangeRef.current);
    }
    sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      wrapSelectionWithStyle(sel.getRangeAt(0), styleProp, val);
    }
    savedRangeRef.current = null;
    emitChange();
  }

  function deselectImage() {
    selectedImg?.classList.remove("rich-img-selected");
    setSelectedImg(null);
  }

  function selectImage(img: HTMLImageElement) {
    if (selectedImg && selectedImg !== img) selectedImg.classList.remove("rich-img-selected");
    img.classList.add("rich-img-selected");
    setSelectedImg(img);
    const currentWidth = img.style.width ? parseInt(img.style.width, 10) : Math.round(img.getBoundingClientRect().width);
    setImgWidth(String(currentWidth || ""));
    setInsertMode(null);
  }

  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      selectImage(target as HTMLImageElement);
    } else if (selectedImg) {
      deselectImage();
    }
  }

  function handleResizeImage(raw: string) {
    setImgWidth(raw);
    if (!selectedImg) return;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      selectedImg.style.width = `${n}px`;
      selectedImg.style.height = "auto";
      selectedImg.style.maxWidth = "none";
      emitChange();
    }
  }

  function handleDeleteImage() {
    selectedImg?.remove();
    setSelectedImg(null);
    emitChange();
  }

  function handleOpenReplace() {
    replaceTargetRef.current = selectedImg;
    setInsertMode("image");
    setImageUrl("");
  }

  function insertImageSrc(src: string) {
    if (replaceTargetRef.current) {
      replaceTargetRef.current.src = src;
      replaceTargetRef.current = null;
      emitChange();
      setInsertMode(null);
      setImageUrl("");
      return;
    }
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

        <button
          type="button"
          className="btn"
          title="Insérer une image"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            replaceTargetRef.current = null;
            setInsertMode((v) => (v === "image" ? null : "image"));
          }}
        >
          🖼 Image
        </button>
        <button
          type="button"
          className="btn"
          title="Image à gauche, texte à droite"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            replaceTargetRef.current = null;
            setInsertMode((v) => (v === "imageTextLeft" ? null : "imageTextLeft"));
          }}
        >
          🖼|T Image + texte
        </button>
        <button
          type="button"
          className="btn"
          title="Texte à gauche, image à droite"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            replaceTargetRef.current = null;
            setInsertMode((v) => (v === "imageTextRight" ? null : "imageTextRight"));
          }}
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
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{replaceTargetRef.current ? "Remplacer par :" : "Insérer :"}</span>
          <input type="text" placeholder="https://…/image.png" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} style={{ flex: 1 }} />
          <button type="button" className="btn btn-primary" onClick={() => handleInsertImage(imageUrl)}>
            {replaceTargetRef.current ? "Remplacer" : "Insérer l'URL"}
          </button>
          <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>ou</span>
          <label className="btn" style={{ cursor: "pointer" }}>
            Importer un fichier
            <input type="file" accept="image/*" onChange={handleFilePick} style={{ display: "none" }} />
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => {
              replaceTargetRef.current = null;
              setInsertMode(null);
            }}
          >
            Annuler
          </button>
        </div>
      )}

      {selectedImg && !insertMode && (
        <div className="rich-editor-image-panel">
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Image sélectionnée</span>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
            Largeur
            <input
              type="number"
              min={10}
              value={imgWidth}
              onChange={(e) => handleResizeImage(e.target.value)}
              style={{ width: 72, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
            />
            px
          </label>
          <button type="button" className="btn" onClick={handleOpenReplace}>
            Remplacer l'image
          </button>
          <button type="button" className="btn" onClick={handleDeleteImage}>
            Supprimer
          </button>
          <button type="button" className="btn" onClick={deselectImage}>
            Fermer
          </button>
        </div>
      )}

      {rawMode ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={10} className="rich-editor-raw" />
      ) : (
        <div
          ref={editorRef}
          className="rich-editor-surface"
          contentEditable
          suppressContentEditableWarning
          onInput={emitChange}
          onBlur={emitChange}
          onClick={handleEditorClick}
        />
      )}
    </div>
  );
}
