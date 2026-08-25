import { useEffect, useState } from "react";
import { api, type CurrentUser } from "./lib/api";
import { Login } from "./pages/Login";
import { Prospects } from "./pages/Prospects";
import { Scoring } from "./pages/Scoring";

type View = "prospects" | "scoring";

export default function App() {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined); // undefined = chargement initial
  const [view, setView] = useState<View>("prospects");

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
          <button className={view === "prospects" ? "active" : ""} onClick={() => setView("prospects")}>
            Prospects
          </button>
          <button className={view === "scoring" ? "active" : ""} onClick={() => setView("scoring")}>
            Scoring
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
      {view === "prospects" ? <Prospects /> : <Scoring isAdmin={user.role === "admin"} />}
    </div>
  );
}
