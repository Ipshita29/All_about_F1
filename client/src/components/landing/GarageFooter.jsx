/*
 * Garage footer — the car from the intro is parked here, completing the
 * journey. Garage lights switch on once when the footer scrolls into view
 * and the rear light pulses once (CSS, IntersectionObserver).
 * Rendered only on the landing page.
 */
import { Link } from "react-router-dom";
import CarVisual from "./F1CarSilhouette";
import useInViewOnce from "../../hooks/useInViewOnce";

const FOOTER_GROUPS = [
    {
        title: "COMPETE",
        links: [
            { to: "/grandprixdashboard", label: "Race Center" },
            { to: "/drivers", label: "Drivers" },
            { to: "/teams", label: "Teams" },
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
    const [ref, inView] = useInViewOnce({ threshold: 0.2 });

    return (
        <footer
            ref={ref}
            className={`lp-footer${inView ? " lp-footer--lit" : ""}`}
            aria-label="Site footer"
        >
            <div className="lp-footer-lights" aria-hidden="true">
                <span /><span /><span />
            </div>

            <div className="lp-footer-garage" aria-hidden="true">
                <div className="lp-footer-car">
                    <CarVisual className="lp-footer-carvisual" />
                </div>
                <div className="lp-footer-floor" />
                <span className="lp-footer-bay lp-mono">BAY 01 — ALL ABOUT F1</span>
            </div>

            <div className="lp-footer-content">
                <div className="lp-footer-brand">
                    <p className="lp-footer-logo">ALL ABOUT F1</p>
                    <p className="lp-footer-line">BUILT FOR THE SPEED. MADE FOR THE STORIES.</p>
                </div>

                <nav className="lp-footer-nav" aria-label="Footer navigation">
                    {FOOTER_GROUPS.map((group) => (
                        <div key={group.title} className="lp-footer-group">
                            <h3 className="lp-footer-group-title lp-mono">{group.title}</h3>
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
                        <h3 className="lp-footer-group-title lp-mono">GARAGE</h3>
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
                <span className="lp-mono">
                    © {new Date().getFullYear()} ALL ABOUT F1 · AN INDEPENDENT FAN PROJECT
                </span>
                <span className="lp-footer-signoff lp-mono">
                    LIGHTS OUT. SEE YOU AT THE NEXT RACE.
                </span>
            </div>
        </footer>
    );
}
