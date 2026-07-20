/*
 * Lightweight educational animations for the Pit Wall Briefing.
 * Pure SVG + CSS (classes live in F1Dictionary.css); each one demonstrates
 * the concept it accompanies — a DRS flap opening, tyre wear stages, a
 * waving marshal flag, a pit-stop wheel change, an undercut/overcut demo.
 * Returns null when a term has no meaningful animation, so nothing is
 * decorated for decoration's sake.
 */

function CarSide({ className = "" }) {
    return (
        <g className={className}>
            {/* floor + body */}
            <path d="M4 34 L20 34 Q24 26 34 25 L58 24 Q66 24 70 20 L78 20 Q84 20 86 25 L96 27 Q100 28 99 32 L98 34 L110 34 L110 38 L4 38 Z" fill="#3d3c38" />
            {/* halo + helmet */}
            <path d="M62 20 Q66 14 72 16" fill="none" stroke="#746d67" strokeWidth="2" />
            <circle cx="67" cy="21" r="3.4" fill="#7f1d1a" />
            {/* wheels */}
            <circle cx="30" cy="36" r="8" fill="#1c1d1d" stroke="#746d67" strokeWidth="1.4" />
            <circle cx="88" cy="36" r="8" fill="#1c1d1d" stroke="#746d67" strokeWidth="1.4" />
            <circle cx="30" cy="36" r="2.4" fill="#746d67" />
            <circle cx="88" cy="36" r="2.4" fill="#746d67" />
        </g>
    );
}

/* DRS — the rear-wing flap pivots open and closed */
function DrsDemo() {
    return (
        <figure className="fd-anim" aria-label="Animated diagram: the DRS rear wing flap opening to reduce drag">
            <svg viewBox="0 0 120 48" className="fd-anim-svg">
                <CarSide />
                {/* rear wing endplate */}
                <line x1="10" y1="14" x2="10" y2="30" stroke="#746d67" strokeWidth="2" />
                {/* main plane */}
                <line x1="6" y1="26" x2="22" y2="26" stroke="#a49f9d" strokeWidth="2.4" />
                {/* the DRS flap — rotates around its trailing edge */}
                <line x1="6" y1="19" x2="22" y2="19" stroke="#b3271e" strokeWidth="2.6" className="fd-anim-drs-flap" />
                <text x="26" y="12" className="fd-anim-tag">DRS FLAP</text>
                {/* airflow lines that speed up when the flap is open */}
                <g className="fd-anim-airflow" stroke="#746d67" strokeWidth="1" strokeDasharray="4 5">
                    <line x1="-30" y1="17" x2="120" y2="17" />
                    <line x1="-30" y1="22" x2="120" y2="22" />
                </g>
            </svg>
            <figcaption className="fd-anim-caption">
                FLAP CLOSED = DOWNFORCE · FLAP OPEN = LESS DRAG, MORE TOP SPEED
            </figcaption>
        </figure>
    );
}

/* Tyres — one tyre cycling through wear stages */
function TyreDemo() {
    return (
        <figure className="fd-anim" aria-label="Animated diagram: a tyre wearing through its life stages">
            <svg viewBox="0 0 120 48" className="fd-anim-svg">
                <g className="fd-anim-tyre">
                    <circle cx="34" cy="24" r="17" fill="#1c1d1d" />
                    <circle cx="34" cy="24" r="17" fill="none" stroke="#b3271e" strokeWidth="3" className="fd-anim-tyre-tread" />
                    <circle cx="34" cy="24" r="7.5" fill="none" stroke="#746d67" strokeWidth="2" />
                </g>
                <g className="fd-anim-tag-group">
                    <text x="62" y="18" className="fd-anim-tag fd-anim-tyre-label-new">NEW — MAX GRIP</text>
                    <text x="62" y="18" className="fd-anim-tag fd-anim-tyre-label-mid">WORN — LOSING PACE</text>
                    <text x="62" y="18" className="fd-anim-tag fd-anim-tyre-label-old">THE CLIFF — BOX BOX</text>
                </g>
                <line x1="62" y1="26" x2="112" y2="26" stroke="#746d67" strokeWidth="1" />
                <rect x="62" y="23.5" height="5" width="50" fill="none" stroke="#746d67" strokeWidth="1" />
                <rect x="62" y="23.5" height="5" width="50" fill="#7f1d1a" className="fd-anim-tyre-life" />
            </svg>
            <figcaption className="fd-anim-caption">
                GRIP FADES LAP BY LAP — STRATEGY IS CHOOSING WHEN TO GIVE IT BACK
            </figcaption>
        </figure>
    );
}

/* Flags — a waving marshal flag, coloured per term */
function FlagDemo({ color, label, chequered = false }) {
    return (
        <figure className="fd-anim" aria-label={`Animated diagram: a waving ${label} flag`}>
            <svg viewBox="0 0 120 48" className="fd-anim-svg">
                <line x1="30" y1="6" x2="30" y2="44" stroke="#746d67" strokeWidth="2.4" />
                <g className="fd-anim-flag">
                    {chequered ? (
                        <>
                            <path d="M30 8 Q46 5 62 8 Q78 11 92 8 L92 26 Q78 29 62 26 Q46 23 30 26 Z" fill="#f2f0ed" />
                            <path d="M30 8 Q38 6.5 46 7 L46 16 Q38 15.5 30 17 Z M62 8 Q70 9.5 78 9 L78 18 Q70 18.5 62 17 Z M46 16 Q54 16.5 62 17 L62 26 Q54 25 46 25 Z M78 18 Q85 17.7 92 17 L92 26 Q85 27 78 27 Z" fill="#141616" />
                        </>
                    ) : (
                        <path d="M30 8 Q46 5 62 8 Q78 11 92 8 L92 26 Q78 29 62 26 Q46 23 30 26 Z" fill={color} />
                    )}
                </g>
            </svg>
            <figcaption className="fd-anim-caption">{label.toUpperCase()} FLAG — SHOWN BY MARSHALS AROUND THE CIRCUIT</figcaption>
        </figure>
    );
}

/* Pit stop — wheel off, wheel on, timed */
function PitStopDemo() {
    return (
        <figure className="fd-anim" aria-label="Animated diagram: a wheel change during a pit stop">
            <svg viewBox="0 0 120 48" className="fd-anim-svg">
                <line x1="8" y1="42" x2="112" y2="42" stroke="#746d67" strokeWidth="1.4" strokeDasharray="3 5" />
                {/* old wheel rolling out */}
                <g className="fd-anim-wheel-out">
                    <circle cx="40" cy="30" r="11" fill="#1c1d1d" stroke="#746d67" strokeWidth="1.6" />
                    <circle cx="40" cy="30" r="4" fill="none" stroke="#746d67" strokeWidth="1.4" />
                </g>
                {/* new wheel rolling in */}
                <g className="fd-anim-wheel-in">
                    <circle cx="40" cy="30" r="11" fill="#1c1d1d" stroke="#b3271e" strokeWidth="2" />
                    <circle cx="40" cy="30" r="4" fill="none" stroke="#b3271e" strokeWidth="1.6" />
                </g>
                {/* wheel gun */}
                <rect x="34" y="8" width="12" height="7" fill="#3d3c38" className="fd-anim-gun" />
                <text x="70" y="20" className="fd-anim-tag fd-anim-stopwatch">~2.3s</text>
            </svg>
            <figcaption className="fd-anim-caption">
                FOUR TYRES, TWENTY MECHANICS, ABOUT TWO SECONDS
            </figcaption>
        </figure>
    );
}

/* Undercut / overcut — two cars, one pits, the order flips */
function StrategyDemo({ overcut = false }) {
    return (
        <figure
            className={`fd-anim${overcut ? " fd-anim--overcut" : ""}`}
            aria-label={`Animated diagram: the ${overcut ? "overcut" : "undercut"} — pitting ${overcut ? "later" : "earlier"} than a rival to jump ahead`}
        >
            <svg viewBox="0 0 120 48" className="fd-anim-svg">
                {/* track + pit lane */}
                <line x1="4" y1="16" x2="116" y2="16" stroke="#746d67" strokeWidth="1.4" />
                <path d="M30 16 Q40 30 56 30 Q72 30 82 16" fill="none" stroke="#746d67" strokeWidth="1" strokeDasharray="3 4" />
                <text x="47" y="40" className="fd-anim-tag">PIT LANE</text>
                {/* rival stays out */}
                <circle r="4" fill="#a49f9d" className="fd-anim-car-rival" />
                {/* our car dives into the pit and emerges ahead */}
                <circle r="4" fill="#b3271e" className="fd-anim-car-hero" />
            </svg>
            <figcaption className="fd-anim-caption">
                {overcut
                    ? "RED STAYS OUT LONGER ON CLEAR AIR — AND EMERGES AHEAD AFTER ITS STOP"
                    : "RED PITS FIRST, USES FRESH-TYRE PACE — AND JUMPS AHEAD WHEN GREY STOPS"}
            </figcaption>
        </figure>
    );
}

/* slug / category → demo */
export default function TermAnimation({ term }) {
    if (!term) return null;
    const slug = term.slug || "";

    if (slug === "drs" || slug === "drs-zone") return <DrsDemo />;
    if (slug === "undercut") return <StrategyDemo />;
    if (slug === "overcut") return <StrategyDemo overcut />;
    if (slug === "pit-stop") return <PitStopDemo />;
    if (slug.includes("yellow-flag")) return <FlagDemo color="#e8b923" label="yellow" />;
    if (slug.includes("red-flag")) return <FlagDemo color="#b3271e" label="red" />;
    if (slug.includes("blue-flag")) return <FlagDemo color="#3b6ea5" label="blue" />;
    if (slug.includes("chequered") || slug.includes("checkered"))
        return <FlagDemo color="#f2f0ed" label="chequered" chequered />;
    if (term.category === "Tyres") return <TyreDemo />;

    return null;
}
