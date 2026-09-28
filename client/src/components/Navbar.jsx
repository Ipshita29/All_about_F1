import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { API_BASE_URL as API } from "../config/api";

/* Exactly the nine navbar destinations, in order — All About F1 (the
   wordmark, already the leftmost element and always linking home) ·
   Live · Predictor · Race Weekend · Drivers · Teams · News ·
   F1 Dictionary · Profile (the account avatar, not a text link here). */
const PRIMARY_LINKS = [
    { to: "/live", label: "Live" },
    { to: "/predictor", label: "Predictor" },
    { to: "/grandprixdashboard", label: "Race Weekend" },
    { to: "/drivers", label: "Drivers" },
    { to: "/teams", label: "Teams" },
    { to: "/news", label: "News" },
    { to: "/dictionary", label: "F1 Dictionary" },
];

function Navbar() {
    const token = localStorage.getItem("token");
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const [accountName, setAccountName] = useState("");
    const [scrolled, setScrolled] = useState(() => window.scrollY > 24);
    const accountRef = useRef(null);

    const isLanding = location.pathname === "/";

    /* just the initial for the avatar — reuses the same /user/profile
       endpoint the Profile page reads, no separate user-data source */
    useEffect(() => {
        if (!token) return;
        fetch(`${API}/user/profile`, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => setAccountName(data?.name || ""))
            .catch(() => setAccountName(""));
    }, [token]);

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
        setAccountOpen(false);
    }

    useEffect(() => {
        if (!accountOpen) return undefined;
        const onKey = (e) => e.key === "Escape" && setAccountOpen(false);
        const onOutside = (e) => {
            if (accountRef.current && !accountRef.current.contains(e.target)) {
                setAccountOpen(false);
            }
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onOutside);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onOutside);
        };
    }, [accountOpen]);

    const close = () => setMenuOpen(false);

    const handleLogout = () => {
        localStorage.removeItem("token");
        window.location.href = "/auth";
    };

    const isActive = (path) => {
        if (path === "/") return location.pathname === "/";
        return location.pathname.startsWith(path);
    };

    const transparent = isLanding && !scrolled;

    return (
        <nav className={`navbar${transparent ? " navbar--top" : ""}`}>
            <div className="navbar-inner">
                <Link to="/" className="navbar-wordmark" onClick={close}>
                    ALL ABOUT F1
                </Link>

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
                </div>

                <div className="navbar-right">
                    {token ? (
                        <div className="navbar-explore" ref={accountRef}>
                            <button
                                type="button"
                                className="navbar-avatar-btn"
                                aria-haspopup="true"
                                aria-expanded={accountOpen}
                                aria-label="Account menu"
                                onClick={() => setAccountOpen((o) => !o)}
                            >
                                {accountName.trim()[0]?.toUpperCase() || "?"}
                            </button>
                            {accountOpen && (
                                <div className="navbar-explore-menu navbar-account-menu" role="menu">
                                    <Link
                                        to="/profile"
                                        role="menuitem"
                                        className="navbar-explore-item"
                                        onClick={() => setAccountOpen(false)}
                                    >
                                        Profile
                                    </Link>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        className="navbar-explore-item navbar-explore-item--danger"
                                        onClick={handleLogout}
                                    >
                                        Log out
                                    </button>
                                </div>
                            )}
                        </div>
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
                    {PRIMARY_LINKS.map(({ to, label }) => (
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
                            <Link to="/profile" className="navbar-mobile-link" onClick={close}>Profile</Link>
                            <button className="navbar-mobile-signout" onClick={handleLogout}>Log out</button>
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
