/*
 * Quick-navigation grid — every tile links to a real route. Restrained:
 * an index number, a label and a one-line description. No decorative
 * imagery, no per-tile animation gimmicks.
 */
import { Link } from "react-router-dom";
import SectionHeader from "./SectionHeader";

const TILES = [
    { to: "/drivers", n: "01", label: "Drivers", copy: "Profiles, careers and stats for the full grid." },
    { to: "/teams", n: "02", label: "Constructors", copy: "Ten teams, one championship." },
    { to: "/grandprixdashboard", n: "03", label: "Race Weekend", copy: "Schedules and results, 2020–2026." },
    { to: "/circuitmaps", n: "04", label: "Circuits", copy: "Track data from every circuit on the calendar." },
    { to: "/dictionary", n: "05", label: "F1 Dictionary", copy: "Every term on the pit wall, explained." },
    { to: "/news", n: "06", label: "News", copy: "The latest stories from the paddock." },
    { to: "/compare-drivers", n: "07", label: "Driver Comparison", copy: "Head-to-head, season by season." },
    { to: "/compare-teams", n: "08", label: "Team Comparison", copy: "Engineering, benchmarked." },
];

export default function ExploreGrid() {
    return (
        <section className="lp-explore" aria-label="Explore All About F1">
            <SectionHeader eyebrow="EXPLORE" title="Every Road In" />

            <div className="lp-explore-grid">
                {TILES.map((t) => (
                    <Link key={t.to} to={t.to} className="lp-explore-tile">
                        <span className="lp-explore-num">{t.n}</span>
                        <h3>{t.label}</h3>
                        <p>{t.copy}</p>
                        <span className="lp-explore-go">ENTER <i aria-hidden="true">→</i></span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
