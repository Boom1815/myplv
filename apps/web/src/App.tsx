import { useEffect, useState } from "react";
import { api, type CurrentUser } from "./lib/api";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Prospects } from "./pages/Prospects";
import { Scoring } from "./pages/Scoring";
import { Blacklist } from "./pages/Blacklist";
import { Sectors } from "./pages/Sectors";
import { GeographicZones } from "./pages/GeographicZones";
import { Offers } from "./pages/Offers";
import { EmailTemplates } from "./pages/EmailTemplates";
import { Campaigns } from "./pages/Campaigns";

type View = "dashboard" | "prospects" | "scoring" | "blacklist" | "sectors" | "zones" | "offers" | "templates" | "campaigns";

export default function App() {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined); // undefined = chargement initial
  const [view, setView] = useState<View>("dashboard");

  useEffect(() => {
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return (
      <div className="login-screen">
        <span className="mono" style={{ color: "var(--ink-faint)" }}>
          Chargement…
        </span>
      </div>
    );
  }

  if (!user) {
    return <Login onLoggedIn={setUser} />;
  }

  async function handleLogout() {
    await api.logout();
    setUser(null);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img src="/logo-myplv.png" alt="MYPLV" width={100} />
          <span>Prospection</span>
        </div>
        <nav className="nav-tabs">
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
            Dashboard
          </button>
          <button className={view === "prospects" ? "active" : ""} onClick={() => setView("prospects")}>
            Prospects
          </button>
          <button className={view === "scoring" ? "active" : ""} onClick={() => setView("scoring")}>
            Scoring
          </button>
          <button className={view === "blacklist" ? "active" : ""} onClick={() => setView("blacklist")}>
            Liste noire
          </button>
          <button className={view === "sectors" ? "active" : ""} onClick={() => setView("sectors")}>
            Secteurs
          </button>
          <button className={view === "zones" ? "active" : ""} onClick={() => setView("zones")}>
            Géographie
          </button>
          <span className="nav-sep" />
          <button className={view === "offers" ? "active" : ""} onClick={() => setView("offers")}>
            Offres
          </button>
          <button className={view === "templates" ? "active" : ""} onClick={() => setView("templates")}>
            Templates
          </button>
          <button className={view === "campaigns" ? "active" : ""} onClick={() => setView("campaigns")}>
            Campagnes
          </button>
        </nav>
        <div className="user">
          <span className="role-pill">{user.role === "admin" ? "Admin" : "Lecture seule"}</span>
          <span>{user.email}</span>
          <button className="btn" onClick={handleLogout}>
            Se déconnecter
          </button>
        </div>
      </header>
      {view === "dashboard" && <Dashboard />}
      {view === "prospects" && <Prospects isAdmin={user.role === "admin"} />}
      {view === "scoring" && <Scoring isAdmin={user.role === "admin"} />}
      {view === "blacklist" && <Blacklist isAdmin={user.role === "admin"} />}
      {view === "sectors" && <Sectors isAdmin={user.role === "admin"} />}
      {view === "zones" && <GeographicZones isAdmin={user.role === "admin"} />}
      {view === "offers" && <Offers isAdmin={user.role === "admin"} />}
      {view === "templates" && <EmailTemplates isAdmin={user.role === "admin"} />}
      {view === "campaigns" && <Campaigns isAdmin={user.role === "admin"} />}
    </div>
  );
}
