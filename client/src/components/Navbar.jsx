import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

const PRIMARY_LINKS = [
    { to: "/grandprixdashboard", label: "Race Center" },
    { to: "/drivers", label: "Drivers" },
    { to: "/teams", label: "Teams" },
];

const EXPLORE_LINKS = [
    { to: "/circuitmaps", label: "Circuits" },
    { to: "/dictionary", label: "F1 Dictionary" },
    { to: "/news", label: "News" },
    { to: "/compare-drivers", label: "Driver Comparison" },
    { to: "/compare-teams", label: "Team Comparison" },
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

function ChevronIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
        </svg>
    );
}

function Navbar() {
    const token = localStorage.getItem("token");
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [exploreOpen, setExploreOpen] = useState(false);
    const [scrolled, setScrolled] = useState(() => window.scrollY > 24);
    const exploreRef = useRef(null);

    const isLanding = location.pathname === "/";

    /* transparent over the landing hero, solid once scrolled */
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 24);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    /* close menus whenever the route changes (state adjustment during
       render, per React docs, instead of a cascading effect) */
    const [lastPath, setLastPath] = useState(location.pathname);
    if (lastPath !== location.pathname) {
        setLastPath(location.pathname);
        setMenuOpen(false);
        setExploreOpen(false);
    }

    /* Explore dropdown: Escape + outside click */
    useEffect(() => {
        if (!exploreOpen) return undefined;
        const onKey = (e) => e.key === "Escape" && setExploreOpen(false);
        const onOutside = (e) => {
            if (exploreRef.current && !exploreRef.current.contains(e.target)) {
                setExploreOpen(false);
            }
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onOutside);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onOutside);
        };
    }, [exploreOpen]);

    const close = () => setMenuOpen(false);

    const handleLogout = () => {
        localStorage.removeItem("token");
        window.location.href = "/auth";
    };

    const isActive = (path) => {
        if (path === "/") return location.pathname === "/";
        return location.pathname.startsWith(path);
    };

    const exploreActive = EXPLORE_LINKS.some((l) => isActive(l.to));

    return (
        <nav
            className={`navbar${isLanding ? " navbar--landing" : ""}${
                isLanding && !scrolled ? " navbar--top" : ""
            }`}
        >
            <div className="navbar-inner">
                <Link to="/" className="navbar-wordmark" onClick={close}>
                    ALL ABOUT F1
                </Link>

                <div className="navbar-divider" />

                <div className="navbar-links">
                    {PRIMARY_LINKS.map(({ to, label }) => (
                        <Link
                            key={to}
                            to={to}
                            className={`navbar-link${isActive(to) ? " navbar-link-active" : ""}`}
                        >
                            {label}
                        </Link>
                    ))}

                    <div className="navbar-explore" ref={exploreRef}>
                        <button
                            type="button"
                            className={`navbar-link navbar-explore-btn${
                                exploreActive ? " navbar-link-active" : ""
                            }`}
                            aria-haspopup="true"
                            aria-expanded={exploreOpen}
                            onClick={() => setExploreOpen((o) => !o)}
                        >
                            Explore <ChevronIcon />
                        </button>
                        {exploreOpen && (
                            <div className="navbar-explore-menu" role="menu">
                                {EXPLORE_LINKS.map(({ to, label }) => (
                                    <Link
                                        key={to}
                                        to={to}
                                        role="menuitem"
                                        className={`navbar-explore-item${
                                            isActive(to) ? " navbar-explore-item-active" : ""
                                        }`}
                                        onClick={() => setExploreOpen(false)}
                                    >
                                        {label}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
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
                    aria-expanded={menuOpen}
                >
                    <span />
                    <span />
                    <span />
                </button>
            </div>

            {menuOpen && (
                <div className="navbar-mobile-menu">
                    <Link
                        to="/"
                        className={`navbar-mobile-link${isActive("/") ? " navbar-mobile-link-active" : ""}`}
                        onClick={close}
                    >
                        Home
                    </Link>
                    {[...PRIMARY_LINKS, ...EXPLORE_LINKS].map(({ to, label }) => (
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
