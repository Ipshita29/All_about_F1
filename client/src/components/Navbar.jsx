import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

const NAV_LINKS = [
    { to: "/", label: "Home" },
    { to: "/grandprixdashboard", label: "Grand Prix" },
    { to: "/drivers", label: "Drivers" },
    { to: "/teams", label: "Teams" },
    { to: "/circuitmaps", label: "Circuits" },
    { to: "/dictionary", label: "Dictionary" },
];

function SettingsIcon() {
    return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    );
}

function UserIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    );
}

function Navbar() {
    const token = localStorage.getItem("token");
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

    const close = () => setMenuOpen(false);

    const handleLogout = () => {
        localStorage.removeItem("token");
        window.location.href = "/auth";
    };

    const isActive = (path) => {
        if (path === "/") return location.pathname === "/";
        return location.pathname.startsWith(path);
    };

    return (
        <nav className="navbar">
            <div className="navbar-inner">
                <Link to="/" className="navbar-logo-link" onClick={close}>
                    <img src="/main/main.png" alt="Formula 1" className="navbar-logo" />
                </Link>

                <div className="navbar-divider" />

                <div className="navbar-links">
                    {NAV_LINKS.map(({ to, label }) => (
                        <Link
                            key={to}
                            to={to}
                            className={`navbar-link${isActive(to) ? " navbar-link-active" : ""}`}
                        >
                            {label}
                        </Link>
                    ))}
                </div>

                <div className="navbar-right">
                    {token ? (
                        <>
                            <Link to="/preferences" className="navbar-icon-btn" title="Preferences">
                                <SettingsIcon />
                            </Link>
                            <Link to="/profile" className="navbar-profile-btn">
                                <UserIcon />
                                <span>Profile</span>
                            </Link>
                            <button className="navbar-signout-btn" onClick={handleLogout}>
                                Sign Out
                            </button>
                        </>
                    ) : (
                        <Link to="/auth" className="navbar-signin-btn">Sign In</Link>
                    )}
                </div>

                <button
                    className={`navbar-hamburger${menuOpen ? " open" : ""}`}
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label="Toggle menu"
                >
                    <span />
                    <span />
                    <span />
                </button>
            </div>

            {menuOpen && (
                <div className="navbar-mobile-menu">
                    {NAV_LINKS.map(({ to, label }) => (
                        <Link
                            key={to}
                            to={to}
                            className={`navbar-mobile-link${isActive(to) ? " navbar-mobile-link-active" : ""}`}
                            onClick={close}
                        >
                            {label}
                        </Link>
                    ))}
                    <div className="navbar-mobile-separator" />
                    {token ? (
                        <>
                            <Link to="/preferences" className="navbar-mobile-link" onClick={close}>Preferences</Link>
                            <Link to="/profile" className="navbar-mobile-link" onClick={close}>Profile</Link>
                            <button className="navbar-mobile-signout" onClick={handleLogout}>Sign Out</button>
                        </>
                    ) : (
                        <Link to="/auth" className="navbar-mobile-link navbar-mobile-link-accent" onClick={close}>Sign In</Link>
                    )}
                </div>
            )}
        </nav>
    );
}

export default Navbar;
