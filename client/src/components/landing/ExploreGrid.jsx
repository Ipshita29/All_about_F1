/*
 * EVERY ROAD IN — asymmetric editorial discovery grid. Every tile links to a
 * real existing route and carries one restrained, tile-specific hover/focus
 * interaction (all CSS, defined in LandingPage.css; nothing animates until
 * the tile is hovered or focused).
 */
import { Link } from "react-router-dom";
import { F1CarSilhouette } from "./F1CarSilhouette";
import { getAllTerms } from "../../utils/dictionaryHelpers";

const TICKER_HEADLINES = [
    "PADDOCK REPORTS, EVERY DAY",
    "TRANSFER TALK & TECH UPDATES",
    "RACE WEEKEND PREVIEWS",
];

function HelmetGlyph() {
    return (
        <svg viewBox="0 0 64 48" className="lp-explore-helmet" aria-hidden="true">
            <path
                d="M8 34 C8 16 20 6 34 6 C48 6 58 16 58 30 L58 36 C58 40 55 42 51 42 L14 42 C10 42 8 39 8 34 Z"
                className="lp-explore-helmet-shell"
            />
            <path d="M30 20 L56 20 L56 30 L28 30 Q26 24 30 20 Z" className="lp-explore-helmet-visor" />
        </svg>
    );
}

function CircuitGlyph() {
    return (
        <svg viewBox="0 0 160 90" className="lp-explore-circuit" aria-hidden="true">
            <path
                className="lp-explore-circuit-path"
                d="M20 70 L34 30 Q37 22 45 23 L86 28 Q94 29 98 22 Q102 14 111 16 L134 22
                   Q143 25 140 34 L128 62 Q125 70 116 70 L36 78 Q24 79 20 70 Z"
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
            />
        </svg>
    );
}

export default function ExploreGrid() {
    const dictTerms = getAllTerms().slice(0, 4).map((t) => t.title);

    return (
        <section className="lp-section lp-explore" aria-label="Explore All About F1">
            <header className="lp-section-head">
                <span className="lp-section-eyebrow">SECTOR 03 — DISCOVERY</span>
                <h2 className="lp-section-title">EVERY ROAD IN</h2>
            </header>

            <div className="lp-explore-grid">
                {/* Drivers — large tile */}
                <Link to="/drivers" className="lp-explore-tile lp-explore-tile--drivers">
                    <HelmetGlyph />
                    <h3>DRIVERS</h3>
                    <p>Profiles, careers and stats for the full grid.</p>
                    <span className="lp-explore-go lp-mono">ENTER →</span>
                </Link>

                {/* Teams — wide tile with passing car */}
                <Link to="/teams" className="lp-explore-tile lp-explore-tile--teams">
                    <div className="lp-explore-carlane" aria-hidden="true">
                        <F1CarSilhouette className="lp-explore-carsvg" />
                    </div>
                    <h3>TEAMS</h3>
                    <p>Ten constructors, one championship.</p>
                    <span className="lp-explore-go lp-mono">ENTER →</span>
                </Link>

                {/* Grand Prix */}
                <Link to="/grandprixdashboard" className="lp-explore-tile lp-explore-tile--gp">
                    <span className="lp-explore-flag" aria-hidden="true" />
                    <h3>GRAND PRIX</h3>
                    <p>Schedules and results, 2020–2026.</p>
                    <span className="lp-explore-go lp-mono">ENTER →</span>
                </Link>

                {/* Circuits — self-drawing track line */}
                <Link to="/circuitmaps" className="lp-explore-tile lp-explore-tile--circuits">
                    <CircuitGlyph />
                    <h3>CIRCUITS</h3>
                    <p>Track maps from around the world.</p>
                    <span className="lp-explore-go lp-mono">ENTER →</span>
                </Link>

                {/* Dictionary — cycling terms */}
                <Link to="/dictionary" className="lp-explore-tile lp-explore-tile--dict">
                    <div className="lp-explore-terms" aria-hidden="true">
                        {dictTerms.map((t) => (
                            <span key={t} className="lp-mono">{t.toUpperCase()}</span>
                        ))}
                    </div>
                    <h3>F1 DICTIONARY</h3>
                    <p>Every term on the pit wall, explained.</p>
                    <span className="lp-explore-go lp-mono">ENTER →</span>
                </Link>

                {/* News — headline ticker */}
                <Link to="/news" className="lp-explore-tile lp-explore-tile--news">
                    <div className="lp-explore-ticker" aria-hidden="true">
                        <span className="lp-mono">{TICKER_HEADLINES.join(" /// ")}</span>
                    </div>
                    <h3>NEWS</h3>
                    <p>The latest from the paddock.</p>
                    <span className="lp-explore-go lp-mono">ENTER →</span>
                </Link>

                {/* Driver comparison */}
                <Link to="/compare-drivers" className="lp-explore-tile lp-explore-tile--compare">
                    <span className="lp-explore-vs lp-mono" aria-hidden="true">
                        <i>DRV</i> VS <i>DRV</i>
                    </span>
                    <h3>DRIVER COMPARISON</h3>
                    <p>Head-to-head, season by season.</p>
                    <span className="lp-explore-go lp-mono">ENTER →</span>
                </Link>

                {/* Race center — decorative timing digits */}
                <Link
                    to="/grandprixdashboard"
                    className="lp-explore-tile lp-explore-tile--racecenter"
                >
                    <span className="lp-explore-timing lp-mono" aria-hidden="true">
                        <span>1:23.456</span>
                        <span>1:22.981</span>
                    </span>
                    <h3>RACE CENTER</h3>
                    <p>Sessions, results and weekends live here.</p>
                    <span className="lp-explore-go lp-mono">ENTER →</span>
                </Link>
            </div>
        </section>
    );
}
