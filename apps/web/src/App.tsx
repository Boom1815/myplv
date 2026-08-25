import { useEffect, useState } from "react";
import { api, type CurrentUser } from "./lib/api";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Prospects } from "./pages/Prospects";
import { Scoring } from "./pages/Scoring";
import { Blacklist } from "./pages/Blacklist";

type View = "dashboard" | "prospects" | "scoring" | "blacklist";

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
          <strong>MYPLV</strong>
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
      {view === "prospects" && <Prospects />}
      {view === "scoring" && <Scoring isAdmin={user.role === "admin"} />}
      {view === "blacklist" && <Blacklist isAdmin={user.role === "admin"} />}
    </div>
  );
}
