/*
 * Site footer. Calm and typographic — no parked car, no light show.
 * Rendered only on the landing page.
 */
import { Link } from "react-router-dom";

const FOOTER_GROUPS = [
    {
        title: "COMPETE",
        links: [
            { to: "/grandprixdashboard", label: "Race Weekend" },
            { to: "/drivers", label: "Drivers" },
            { to: "/teams", label: "Constructors" },
            { to: "/circuitmaps", label: "Circuits" },
        ],
    },
    {
        title: "ANALYSE",
        links: [
            { to: "/compare-drivers", label: "Driver Comparison" },
            { to: "/compare-teams", label: "Team Comparison" },
        ],
    },
    {
        title: "FOLLOW",
        links: [
            { to: "/news", label: "News" },
            { to: "/dictionary", label: "F1 Dictionary" },
        ],
    },
];

export default function GarageFooter({ isAuthenticated }) {
    return (
        <footer className="lp-footer" aria-label="Site footer">
            <div className="lp-footer-content">
                <div className="lp-footer-brand">
                    <p className="lp-footer-logo">ALL ABOUT F1</p>
                    <p className="lp-footer-line">A premium Formula 1 intelligence platform.</p>
                </div>

                <nav className="lp-footer-nav" aria-label="Footer navigation">
                    {FOOTER_GROUPS.map((group) => (
                        <div key={group.title} className="lp-footer-group">
                            <h3 className="lp-footer-group-title">{group.title}</h3>
                            <ul>
                                {group.links.map((l) => (
                                    <li key={l.to + l.label}>
                                        <Link to={l.to}>{l.label}</Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                    <div className="lp-footer-group">
                        <h3 className="lp-footer-group-title">ACCOUNT</h3>
                        <ul>
                            {isAuthenticated ? (
                                <>
                                    <li><Link to="/profile">Profile</Link></li>
                                    <li><Link to="/preferences">Preferences</Link></li>
                                </>
                            ) : (
                                <li><Link to="/auth">Sign In</Link></li>
                            )}
                        </ul>
                    </div>
                </nav>
            </div>

            <div className="lp-footer-bottom">
                <span>© {new Date().getFullYear()} All About F1 · An independent fan project</span>
            </div>
        </footer>
    );
}
