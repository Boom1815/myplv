import { useEffect, useRef, useState } from "react";

/**
 * Petit bouton "i" affichant un mode d'emploi contextuel au clic — utilisé à
 * côté des titres de section, des champs et des actions dans tout
 * l'écran pour rester utilisable sans documentation externe.
 */
export function InfoTooltip({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="info-wrap" ref={ref}>
      <button
        type="button"
        className={`info-btn${open ? " open" : ""}`}
        aria-label="Aide"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        i
      </button>
      {open && (
        <span className={`info-popover${align === "right" ? " align-right" : ""}`} role="tooltip">
          {children}
        </span>
      )}
    </span>
  );
}
