import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Filet de sécurité : sans lui, une erreur JS pendant le rendu démonte tout
 * React et laisse une page blanche, sans le moindre indice pour
 * l'utilisateur (ex. un bloc "Colonnes" enregistré en localStorage avant
 * l'ajout d'un nouveau réglage — voir normalizeBlock dans
 * RichEmailEditor.tsx pour le cas précis qui a motivé cet ajout). Affiche
 * un message clair + un moyen de revenir, au lieu de rien du tout.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("Erreur non interceptée :", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "60px 24px", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ marginBottom: 10 }}>Un problème est survenu</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginBottom: 20 }}>
            L'affichage de cette page a échoué de façon inattendue. Recharge-la — si le problème revient, préviens-nous.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
