/*
 * HERO — a landing-page hero, not a race dashboard. Answers "what is this
 * product" in the first viewport: identity, value proposition, two CTAs.
 * Live race data (round, countdown) lives one section down in
 * NextGrandPrix — keeping this section simple, as requested, rather than
 * cramming live data into the very first thing a visitor sees.
 *
 * The background visual is an abstract, decorative telemetry/track-line
 * pattern — not tied to any real circuit — kept deliberately quiet (low
 * opacity, a handful of lines) so it reads as texture, not a widget.
 */
import Button from "../ui/Button";

function AbstractLines() {
    return (
        <svg
            className="hero-lines"
            viewBox="0 0 1200 700"
            fill="none"
            preserveAspectRatio="xMaxYMid slice"
            aria-hidden="true"
        >
            <path d="M-40 560 L340 560 Q400 560 430 500 L520 320 Q550 260 610 260 L1240 260" strokeWidth="1.5" />
            <path d="M-40 640 L260 640 Q330 640 360 580 L520 420 Q560 340 630 340 L1240 340" strokeWidth="1.5" />
            <path d="M-40 480 L420 480 Q470 480 495 430 L560 240 Q585 160 655 160 L1240 160" strokeWidth="1.5" />
            <circle cx="610" cy="260" r="4" className="hero-lines-dot" />
        </svg>
    );
}

export default function Hero() {
    return (
        <section className="hero" aria-label="All About F1">
            <AbstractLines />
            <div className="hero-inner">
                <p className="hero-eyebrow">FORMULA 1 · RACE INTELLIGENCE</p>
                <h1 className="hero-title">
                    The Complete
                    <br />
                    Formula 1
                    <br />
                    Intelligence Platform
                </h1>
                <p className="hero-sub">
                    Follow the championship, understand race weekends, compare drivers
                    and teams, and explore the data behind every Grand Prix.
                </p>
                <div className="hero-actions">
                    <Button variant="primary" to="/grandprixdashboard" arrow>
                        Enter Race HQ
                    </Button>
                    <Button variant="secondary" href="#next-grand-prix" arrow>
                        Explore The Season
                    </Button>
                </div>
            </div>
        </section>
    );
}
