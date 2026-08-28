import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LabPage } from "./__design_lab/LabPage";
import "./styles/global.css";

// Design Lab temporaire (exploration de refonte) — ?design_lab=true,
// jamais atteint autrement. Supprimé (avec tout le dossier __design_lab)
// une fois la direction choisie.
const isDesignLab = new URLSearchParams(location.search).has("design_lab");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isDesignLab ? <LabPage /> : <App />}</React.StrictMode>,
);
