/** Design Lab — topbar partagée par les 5 variantes (même structure que le vrai App.tsx), chaque variante la restyle via son propre CSS scopé. */
export function Topbar() {
  return (
    <header className="topbar">
      <div className="brand">
        <img src="/logo-myplv.png" alt="MYPLV" width={40} />
        <span>Prospection</span>
      </div>
      <nav className="nav-tabs">
        <button className="active">Dashboard</button>
        <button>Prospects</button>
        <button>Scoring</button>
        <button>Liste noire</button>
        <span className="nav-sep" />
        <button>Offres</button>
        <button>Templates</button>
        <button>Campagnes</button>
      </nav>
      <div className="user">
        <span className="role-pill">Admin</span>
        <span>info@myplv.be</span>
        <button className="btn">Se déconnecter</button>
      </div>
    </header>
  );
}
