/*
 * PLATFORM OVERVIEW — "One platform. Every part of F1." Explains what the
 * product actually does: headline + intro, one large abstract technical
 * visual (a light Cararra panel built from circuit geometry / sector
 * markers / telemetry-style readouts — nothing photographic, nothing
 * pulled in just to fill space), then the six platform areas as a clean
 * list rather than six competing cards.
 */
import { Link } from "react-router-dom";
import SectionHeader from "../ui/SectionHeader";

const AREAS = [
    { n: "01", to: "/grandprixdashboard", title: "Race Weekend", copy: "Schedules, sessions and results for every round." },
    { n: "02", to: "/drivers", title: "Drivers", copy: "Profiles, careers and performance." },
    { n: "03", to: "/teams", title: "Constructors", copy: "Teams, standings and engineering context." },
    { n: "04", to: "/circuitmaps", title: "Circuits", copy: "Track data and circuit intelligence." },
    { n: "05", to: "/compare-drivers", title: "Comparison", copy: "Put drivers and teams head-to-head." },
    { n: "06", to: "/dictionary", title: "F1 Dictionary", copy: "Understand the language of the sport." },
];

/* Abstract circuit + telemetry composition. Not a real track, not tied to
   live data — a decorative technical drawing that visually says "every
   part of F1 in one place": a racing line, sector markers, a ghost race
   number and a couple of readout-style labels. */
function TechnicalVisual() {
    return (
        <div className="platform-visual" aria-hidden="true">
            <svg
                viewBox="0 0 560 400"
                fill="none"
                preserveAspectRatio="xMidYMid slice"
                className="platform-visual-svg"
            >
                <path
                    className="platform-visual-grid"
                    d="M0 80H560M0 160H560M0 240H560M0 320H560M80 0V400M160 0V400M240 0V400M320 0V400M400 0V400M480 0V400"
                    strokeWidth="1"
                />
                <path
                    className="platform-visual-line"
                    d="M40 300 L140 300 Q180 300 190 260 L210 150 Q216 110 256 105 L340 96
                       Q372 92 380 60 L392 24 Q398 6 420 6 L520 6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />
                <circle className="platform-visual-dot" cx="256" cy="105" r="4" />
                <circle className="platform-visual-dot" cx="420" cy="6" r="4" />
                <text x="150" y="330" className="platform-visual-label">SECTOR 1</text>
                <text x="300" y="130" className="platform-visual-label">SECTOR 2</text>
                <text x="430" y="30" className="platform-visual-label">SECTOR 3</text>
            </svg>

            <span className="platform-visual-number">44</span>

            <div className="platform-visual-readout">
                <span>
                    <b>1:28.947</b>
                    <small>BEST LAP</small>
                </span>
                <span>
                    <b>312</b>
                    <small>KM/H</small>
                </span>
            </div>
        </div>
    );
}

export default function PlatformOverview() {
    return (
        <section className="platform" aria-label="What All About F1 does">
            <div className="platform-intro">
                <SectionHeader
                    eyebrow="THE PLATFORM"
                    title="One platform. Every part of F1."
                    description="All About F1 brings the championship, race weekends, driver and team data, and circuit intelligence into one place — so you don't need six different sources to follow the sport properly."
                />
            </div>

            <TechnicalVisual />

            <ol className="platform-list">
                {AREAS.map((a) => (
                    <li key={a.to}>
                        <Link to={a.to} className="platform-row">
                            <span className="platform-row-num">{a.n}</span>
                            <span className="platform-row-title">{a.title}</span>
                            <span className="platform-row-copy">{a.copy}</span>
                            <span className="platform-row-go" aria-hidden="true">→</span>
                        </Link>
                    </li>
                ))}
            </ol>
        </section>
    );
}
