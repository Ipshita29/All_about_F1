import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

const PRIMARY_LINKS = [
    { to: "/grandprixdashboard", label: "Race Weekend" },
    { to: "/drivers", label: "Drivers" },
    { to: "/teams", label: "Constructors" },
    { to: "/news", label: "News" },
];

const MORE_LINKS = [
    { to: "/circuitmaps", label: "Circuits" },
    { to: "/dictionary", label: "F1 Dictionary" },
    { to: "/compare-drivers", label: "Driver Comparison" },
    { to: "/compare-teams", label: "Team Comparison" },
];

function ChevronIcon() {
    return (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
        </svg>
    );
}

function Navbar() {
    const token = localStorage.getItem("token");
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [scrolled, setScrolled] = useState(() => window.scrollY > 24);
    const moreRef = useRef(null);

    const isLanding = location.pathname === "/";

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 24);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    /* close menus whenever the route changes */
    const [lastPath, setLastPath] = useState(location.pathname);
    if (lastPath !== location.pathname) {
        setLastPath(location.pathname);
        setMenuOpen(false);
        setMoreOpen(false);
    }

    useEffect(() => {
        if (!moreOpen) return undefined;
        const onKey = (e) => e.key === "Escape" && setMoreOpen(false);
        const onOutside = (e) => {
            if (moreRef.current && !moreRef.current.contains(e.target)) {
                setMoreOpen(false);
            }
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onOutside);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onOutside);
        };
    }, [moreOpen]);

    const close = () => setMenuOpen(false);

    const handleLogout = () => {
        localStorage.removeItem("token");
        window.location.href = "/auth";
    };

    const isActive = (path) => {
        if (path === "/") return location.pathname === "/";
        return location.pathname.startsWith(path);
    };

    const moreActive = MORE_LINKS.some((l) => isActive(l.to));
    const transparent = isLanding && !scrolled;

    return (
        <nav className={`navbar${transparent ? " navbar--top" : ""}`}>
            <div className="navbar-inner">
                <Link to="/" className="navbar-wordmark" onClick={close}>
                    ALL ABOUT F1
                </Link>

                <div className="navbar-links">
                    <Link
                        to="/"
                        className={`navbar-link${isActive("/") ? " navbar-link-active" : ""}`}
                    >
                        Overview
                    </Link>
                    {PRIMARY_LINKS.map(({ to, label }) => (
                        <Link
                            key={to}
                            to={to}
                            className={`navbar-link${isActive(to) ? " navbar-link-active" : ""}`}
                        >
                            {label}
                        </Link>
                    ))}

                    <div className="navbar-explore" ref={moreRef}>
                        <button
                            type="button"
                            className={`navbar-link navbar-explore-btn${
                                moreActive ? " navbar-link-active" : ""
                            }`}
                            aria-haspopup="true"
                            aria-expanded={moreOpen}
                            onClick={() => setMoreOpen((o) => !o)}
                        >
                            More <ChevronIcon />
                        </button>
                        {moreOpen && (
                            <div className="navbar-explore-menu" role="menu">
                                {MORE_LINKS.map(({ to, label }) => (
                                    <Link
                                        key={to}
                                        to={to}
                                        role="menuitem"
                                        className={`navbar-explore-item${
                                            isActive(to) ? " navbar-explore-item-active" : ""
                                        }`}
                                        onClick={() => setMoreOpen(false)}
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
                            <Link to="/preferences" className="navbar-profile-btn">
                                Preferences
                            </Link>
                            <Link to="/profile" className="navbar-profile-btn">
                                Profile
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
                        Overview
                    </Link>
                    {[...PRIMARY_LINKS, ...MORE_LINKS].map(({ to, label }) => (
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
