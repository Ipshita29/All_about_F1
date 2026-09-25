/*
 * Homepage — a premium Formula 1 intelligence platform landing page.
 *
 * This file owns all landing-page data fetching (same backend endpoints as
 * before — nothing here changed) and composes its sections as local
 * components defined below — each one was only ever used on this page, so
 * they live here rather than as separate files in components/. Page order,
 * alternating dark and light surfaces per the Phase 1 design system:
 *
 *   Hero (dark) → NextGrandPrix (light) → GridInvite (floating) →
 *   PlatformOverview (dark) → RaceIntelligence (light) →
 *   ChampionshipSection (dark) → PaddockNews (light) →
 *   ExploreGrid (dark) → GarageFooter (dark), with PitWallRadio floating.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

import { Button } from "../components/UI";
import useCountdown from "../hooks/useCountdown";
import {
    buildFavourites,
    findLiveSession,
    findNextSession,
    formatWeekendRange,
    getWeekendSessions,
    positionsGained,
    isFavouriteDriver,
    isFavouriteTeam,
    articleIsForYou,
    formatArticleTime,
    isRelevantF1Article,
} from "../utils/landingHelpers";
import { getWordOfTheDay } from "../utils/dictionaryHelpers";

import "../styles/pages/LandingPage.css";
import { API_BASE_URL as API } from "../config/api";

/* ══════════════════════════════════════════════════════════════════
 * Shared section header — a small mono eyebrow over an Inter title,
 * with an optional description. Only used on this page.
 * ══════════════════════════════════════════════════════════════════ */

function SectionHeader({ eyebrow, title, description, onLight = false, className = "" }) {
    return (
        <header className={`section-header${onLight ? " section-header--on-light" : ""}${className ? ` ${className}` : ""}`}>
            {eyebrow && <span className="section-header-eyebrow">{eyebrow}</span>}
            {title && <h2 className="section-header-title">{title}</h2>}
            {description && <p className="section-header-desc">{description}</p>}
        </header>
    );
}

/* ══════════════════════════════════════════════════════════════════
 * HERO — a landing-page hero, not a race dashboard. Answers "what is
 * this product" in the first viewport: identity, value proposition,
 * two CTAs. Live race data (round, countdown) lives one section down
 * in NextGrandPrix. The background visual is an abstract, decorative
 * telemetry/track-line pattern — not tied to any real circuit.
 * ══════════════════════════════════════════════════════════════════ */

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

function Hero() {
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

/* ══════════════════════════════════════════════════════════════════
 * NEXT GRAND PRIX — a premium race announcement, not a dashboard
 * card. Sits on a light Cararra surface directly under the dark hero
 * for strong contrast. Shows whichever session is most relevant
 * right now: LIVE or the next upcoming one.
 * ══════════════════════════════════════════════════════════════════ */

function pad(n) {
    return String(n).padStart(2, "0");
}

function NextGrandPrix({ liveSession, nextSession, scheduleError }) {
    const isLive = Boolean(liveSession);
    const session = liveSession || nextSession;
    const race = session?.race || null;
    const sessions = race ? getWeekendSessions(race) : [];
    const raceSession = sessions.find((s) => s.key === "Race");
    const countdown = useCountdown(!isLive && raceSession ? raceSession.start : null);

    return (
        <section id="next-grand-prix" className="next-gp" aria-label="Next Grand Prix">
            <div className="next-gp-inner">
                <span className="next-gp-eyebrow">
                    {isLive ? `LIVE — ${session.label.toUpperCase()}` : "NEXT GRAND PRIX"}
                </span>

                {!race ? (
                    <p className="next-gp-empty">
                        {scheduleError
                            ? "Season schedule unavailable right now."
                            : "Loading the season schedule…"}
                    </p>
                ) : (
                    <>
                        <h2 className="next-gp-title">{race.raceName}</h2>
                        <p className="next-gp-meta">
                            ROUND {race.round} · {race.season} — {race.Circuit?.circuitName}
                        </p>
                        <p className="next-gp-range">{formatWeekendRange(race)}</p>

                        {!isLive && raceSession && countdown.total > 0 && (
                            <div
                                className="next-gp-countdown"
                                role="timer"
                                aria-label={`Race starts in ${countdown.days} days ${countdown.hours} hours ${countdown.minutes} minutes`}
                            >
                                {[
                                    [countdown.days, "DAYS"],
                                    [countdown.hours, "HRS"],
                                    [countdown.minutes, "MIN"],
                                ].map(([val, lbl]) => (
                                    <span key={lbl}>
                                        <b>{pad(val)}</b>
                                        <small>{lbl}</small>
                                    </span>
                                ))}
                            </div>
                        )}

                        <Button
                            variant="dark"
                            to={`/grandprixdashboard/${race.season}/${race.round}`}
                            arrow
                        >
                            {isLive ? "Follow The Session" : "Enter Race HQ"}
                        </Button>
                    </>
                )}
            </div>
        </section>
    );
}

/* ══════════════════════════════════════════════════════════════════
 * Delayed personalization invitation for logged-out visitors. Slides
 * in from the bottom-right ~8s after the page loads, is dismissible,
 * and stays dismissed for the rest of the browser session.
 * ══════════════════════════════════════════════════════════════════ */

const DISMISS_KEY = "aaf1_invite_dismissed";
const SHOW_DELAY_MS = 8000;

function wasDismissed() {
    try {
        return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
        return false;
    }
}

function GridInvite({ isAuthenticated }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isAuthenticated || wasDismissed()) return undefined;
        const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
        return () => clearTimeout(timer);
    }, [isAuthenticated]);

    const dismiss = () => {
        try {
            sessionStorage.setItem(DISMISS_KEY, "1");
        } catch {
            /* ignore */
        }
        setVisible(false);
    };

    if (isAuthenticated || !visible) return null;

    return (
        <aside
            className="lp-invite"
            aria-label="Personalize your feed"
            onKeyDown={(e) => e.key === "Escape" && dismiss()}
        >
            <button className="lp-invite-close" onClick={dismiss} aria-label="Dismiss invitation">
                <X size={14} />
            </button>
            <p className="lp-invite-eyebrow">PERSONALIZE</p>
            <h3 className="lp-invite-title">Make this your grid</h3>
            <p className="lp-invite-copy">
                Follow a driver and a team to surface the stories, standings
                and results that matter most to you.
            </p>
            <div className="lp-invite-actions">
                <Link to="/auth" className="lp-invite-primary" onClick={dismiss}>
                    Sign in
                </Link>
                <button className="lp-invite-secondary" onClick={dismiss}>
                    Not now
                </button>
            </div>
        </aside>
    );
}

/* ══════════════════════════════════════════════════════════════════
 * PLATFORM OVERVIEW — "One platform. Every part of F1." Explains
 * what the product actually does: headline + intro, one large
 * abstract technical visual, then the six platform areas as a clean
 * list rather than six competing cards.
 * ══════════════════════════════════════════════════════════════════ */

const AREAS = [
    { n: "01", to: "/grandprixdashboard", title: "Race Weekend", copy: "Schedules, sessions and results for every round." },
    { n: "02", to: "/drivers", title: "Drivers", copy: "Profiles, careers and performance." },
    { n: "03", to: "/teams", title: "Constructors", copy: "Teams, standings and engineering context." },
    { n: "04", to: "/circuitmaps", title: "Circuits", copy: "Track data and circuit intelligence." },
    { n: "05", to: "/compare-drivers", title: "Comparison", copy: "Put drivers and teams head-to-head." },
    { n: "06", to: "/dictionary", title: "F1 Dictionary", copy: "Understand the language of the sport." },
];

function PlatformOverview() {
    return (
        <section className="platform" aria-label="What All About F1 does">
            <div className="platform-intro">
                <SectionHeader
                    eyebrow="THE PLATFORM"
                    title="One platform. Every part of F1."
                    description="All About F1 brings the championship, race weekends, driver and team data, and circuit intelligence into one place — so you don't need six different sources to follow the sport properly."
                />
            </div>

            <div className="platform-visual">
                <img src="/homepage.png" alt="" className="platform-visual-img" loading="lazy" />
            </div>

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

/* ══════════════════════════════════════════════════════════════════
 * RACE INTELLIGENCE — a data-grounded recap of the last Grand Prix,
 * on a light Chalk surface for an editorial, print-like read. There
 * is no AI/LLM backend wired into this project, so rather than
 * fabricate prose this reads as an editorial brief built entirely
 * from the real classification returned by /grandprixdashboard/latest.
 * ══════════════════════════════════════════════════════════════════ */

function fullName(driver) {
    if (!driver) return "—";
    return `${driver.givenName} ${driver.familyName}`;
}

function RaceIntelligence({ race }) {
    if (!race) return null;

    const results = race.Results || [];
    const winner = results[0];
    const second = results[1];
    if (!winner) return null;

    const fastest = results.find((r) => r.FastestLap?.rank === "1");
    const gapText = second
        ? second.Time?.time || second.status || null
        : null;

    const mover = results.reduce((best, r) => {
        const gain = positionsGained(r);
        if (gain === null) return best;
        if (!best || gain > positionsGained(best)) return r;
        return best;
    }, null);
    const moverGain = mover ? positionsGained(mover) : 0;

    const startedText =
        winner.grid === "1" ? "from pole position" : `from P${winner.grid}`;

    /* Every stat is { label, name?, value }. `name` (when present) is the
       driver's full name, always shown on its own line above the value. */
    const stats = [
        { label: "Winner", name: fullName(winner.Driver) },
        gapText && { label: "Winning Gap", value: gapText },
        fastest && { label: "Fastest Lap", name: fullName(fastest.Driver), value: fastest.FastestLap.Time.time },
        mover && moverGain > 0 && { label: "Biggest Mover", name: fullName(mover.Driver), value: `+${moverGain} POSITIONS` },
    ].filter(Boolean);

    return (
        <section className="ri" aria-label="Race intelligence">
            <div className="ri-inner">
                <SectionHeader
                    onLight
                    eyebrow="RACE INTELLIGENCE"
                    title="What happened at the last Grand Prix"
                    className="ri-head"
                />
                <p className="ri-race">{race.raceName?.toUpperCase()} · ROUND {race.round}</p>

                <div className="ri-body">
                    <p className="ri-lede">
                        <b>{fullName(winner.Driver)}</b> won the {race.raceName} {startedText}
                        {gapText ? `, finishing ${gapText} clear of ${fullName(second?.Driver)}` : ""}.
                        {fastest && fastest.Driver.driverId !== winner.Driver.driverId && (
                            <> {fullName(fastest.Driver)} set the race&rsquo;s fastest lap.</>
                        )}
                        {mover && moverGain > 2 && (
                            <> {fullName(mover.Driver)} was the day&rsquo;s biggest mover, gaining {moverGain} places from the grid.</>
                        )}
                    </p>

                    <ul className="ri-stats">
                        {stats.map((s) => (
                            <li key={s.label} className="ri-stat">
                                <span className="ri-stat-label">{s.label}</span>
                                {s.name && <span className="ri-stat-name">{s.name}</span>}
                                {s.value && <span className="ri-stat-value">{s.value}</span>}
                            </li>
                        ))}
                    </ul>

                    <Button variant="dark" to={`/grandprixdashboard/${race.season}/${race.round}`} arrow>
                        Read Full Analysis
                    </Button>
                </div>
            </div>
        </section>
    );
}

/* ══════════════════════════════════════════════════════════════════
 * THE TITLE FIGHT — a curated top 3, not a standings table. An
 * accessible DRIVERS | CONSTRUCTORS toggle switches which
 * championship is shown; "View Full Standings" hands off to the
 * real roster page for the rest.
 * ══════════════════════════════════════════════════════════════════ */

const VIEWS = [
    { id: "drivers", label: "DRIVERS" },
    { id: "constructors", label: "CONSTRUCTORS" },
];

function ChampionshipSection({ driverStandings, constructorStandings, favs }) {
    const [view, setView] = useState("drivers");
    const tabRefs = useRef([]);
    const isDrivers = view === "drivers";

    const onTabKeyDown = (e, index) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const next = (index + (e.key === "ArrowRight" ? 1 : VIEWS.length - 1)) % VIEWS.length;
        setView(VIEWS[next].id);
        tabRefs.current[next]?.focus();
    };

    const standings = (isDrivers ? driverStandings : constructorStandings) || [];
    const top3 = standings.slice(0, 3);
    const hasData = top3.length > 0;

    return (
        <section className="champ" aria-label="Championship standings">
            <div className="champ-head">
                <SectionHeader eyebrow="WORLD CHAMPIONSHIP" title="The Title Fight" />
                <div className="champ-toggle" role="tablist" aria-label="Championship type">
                    {VIEWS.map((v, i) => (
                        <button
                            key={v.id}
                            ref={(el) => (tabRefs.current[i] = el)}
                            role="tab"
                            aria-selected={view === v.id}
                            tabIndex={view === v.id ? 0 : -1}
                            className={`champ-tab${view === v.id ? " is-active" : ""}`}
                            onClick={() => setView(v.id)}
                            onKeyDown={(e) => onTabKeyDown(e, i)}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
            </div>

            {!hasData ? (
                <p className="lp-inline-state">STANDINGS UNAVAILABLE</p>
            ) : (
                <ol className="champ-podium">
                    {top3.map((s, i) => {
                        const driver = isDrivers ? s.Driver : null;
                        const constructor = isDrivers ? s.Constructors?.[0] : s.Constructor;
                        const fav = isDrivers
                            ? isFavouriteDriver(favs, driver) || isFavouriteTeam(favs, constructor)
                            : isFavouriteTeam(favs, constructor);
                        const isLeader = i === 0;
                        return (
                            <li
                                key={isDrivers ? driver.driverId : constructor.constructorId}
                                className={`champ-spot${isLeader ? " champ-spot--leader" : ""}`}
                            >
                                <div className="champ-spot-top">
                                    <span className="champ-spot-pos">P{s.position}</span>
                                    {isLeader && <span className="champ-spot-tag">CHAMPIONSHIP LEADER</span>}
                                    {fav && <span className="champ-spot-fav">FAV</span>}
                                </div>

                                <h3 className="champ-spot-name">
                                    {isDrivers ? (
                                        <>{driver.givenName} <b>{driver.familyName}</b></>
                                    ) : (
                                        <b>{constructor.name}</b>
                                    )}
                                </h3>
                                <p className="champ-spot-team">
                                    {isDrivers ? constructor?.name : constructor.nationality}
                                </p>

                                <div className="champ-spot-pts">
                                    <span className="champ-spot-pts-value">{s.points}</span>
                                    <span className="champ-spot-pts-label">POINTS</span>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}

            <Button variant="secondary" to={isDrivers ? "/drivers" : "/teams"} arrow className="champ-more">
                View Full Standings
            </Button>
        </section>
    );
}

/* ══════════════════════════════════════════════════════════════════
 * FROM THE PADDOCK — quiet editorial news section on a light Cararra
 * surface: one featured story with a fixed-ratio image, three
 * text-only supporting stories. Articles are filtered to exclude
 * stories clearly about a different racing series before display.
 * ══════════════════════════════════════════════════════════════════ */

function ForYouTag() {
    return <span className="lp-news-foryou">FOR YOU</span>;
}

/* Small thumbnail for a supporting story. Same real article.image field
   the featured story and the News page both use — this was previously
   just never rendered here at all, not a bad data source; a neutral
   surface fills in only if the image genuinely has none or fails to load. */
function NewsThumb({ article, className }) {
    const [failed, setFailed] = useState(false);
    const hasImage = Boolean(article.image) && !failed;
    return (
        <span className={`news-item-img${hasImage ? "" : " news-item-img--missing"}${className ? ` ${className}` : ""}`} aria-hidden="true">
            {hasImage ? (
                <img src={article.image} alt="" loading="lazy" onError={() => setFailed(true)} />
            ) : (
                <span className="news-item-img-mark">FROM THE PADDOCK</span>
            )}
        </span>
    );
}

function PaddockNews({ articles, favs, error }) {
    const relevant = (articles || []).filter(isRelevantF1Article);

    if (error) {
        return (
            <section className="news" aria-label="Formula 1 news">
                <SectionHeader onLight eyebrow="LATEST STORIES" title="From The Paddock" />
                <p className="lp-inline-state">NEWS FEED UNAVAILABLE — COULD NOT REACH THE NEWS SERVER</p>
            </section>
        );
    }

    if (!relevant.length) return null;

    const [featured, ...rest] = relevant;
    const supporting = rest.slice(0, 3);

    return (
        <section className="news" aria-label="Formula 1 news">
            <div className="news-head">
                <SectionHeader onLight eyebrow="LATEST STORIES" title="From The Paddock" />
                <Button variant="secondary" to="/news" arrow>View All Stories</Button>
            </div>

            <div className="news-grid">
                <a href={featured.url} target="_blank" rel="noreferrer" className="news-featured">
                    <NewsThumb article={featured} className="news-featured-img" />
                    <div className="news-featured-body">
                        <p className="news-meta">
                            {featured.source?.toUpperCase()} · {formatArticleTime(featured.publishedAt)}
                            {articleIsForYou(featured, favs) && <ForYouTag />}
                        </p>
                        <h3 className="news-featured-title">{featured.title}</h3>
                        {featured.description && <p className="news-featured-desc">{featured.description}</p>}
                        <span className="news-readmore">READ STORY →</span>
                    </div>
                </a>

                <div className="news-side">
                    {supporting.map((article) => (
                        <a key={article.id} href={article.url} target="_blank" rel="noreferrer" className="news-item">
                            <NewsThumb article={article} className="news-item-img--large" />
                            <div className="news-item-body">
                                <p className="news-meta">
                                    {article.source?.toUpperCase()} · {formatArticleTime(article.publishedAt)}
                                    {articleIsForYou(article, favs) && <ForYouTag />}
                                </p>
                                <h3 className="news-item-title">{article.title}</h3>
                                {article.description && <p className="news-item-desc">{article.description}</p>}
                                <span className="news-readmore">READ STORY →</span>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ══════════════════════════════════════════════════════════════════
 * Floating "Term of the Day" chip — a quiet nudge toward the F1
 * Dictionary. Appears only after the visitor scrolls past the hero,
 * hides while the footer is on screen. The term comes from the
 * existing dictionary data via getWordOfTheDay().
 * ══════════════════════════════════════════════════════════════════ */

function PitWallRadio({ favs, footerRef }) {
    const [term] = useState(getWordOfTheDay);
    const [pastHero, setPastHero] = useState(false);
    const [footerVisible, setFooterVisible] = useState(false);
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);
    const tabRef = useRef(null);

    useEffect(() => {
        const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.6);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        const el = footerRef?.current;
        if (!el || typeof IntersectionObserver === "undefined") return undefined;
        const observer = new IntersectionObserver(
            (entries) => setFooterVisible(entries.some((e) => e.isIntersecting)),
            { threshold: 0.05 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [footerRef]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") {
                setOpen(false);
                tabRef.current?.focus();
            }
        };
        const onOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onOutside);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onOutside);
        };
    }, [open]);

    if (!term) return null;
    const hidden = !pastHero || footerVisible;

    return (
        <div
            className={`lp-radio${hidden ? " lp-radio--hidden" : ""}${open ? " lp-radio--open" : ""}`}
            style={favs?.teamColor ? { "--radio-accent": favs.teamColor } : undefined}
        >
            {!open && (
                <button
                    ref={tabRef}
                    type="button"
                    className="lp-radio-tab"
                    onClick={() => setOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={false}
                    tabIndex={hidden ? -1 : 0}
                >
                    <span className="lp-radio-head">TERM OF THE DAY</span>
                    <span className="lp-radio-cta">
                        {term.title} <span aria-hidden="true">→</span>
                    </span>
                </button>
            )}

            {open && (
                <div ref={panelRef} className="lp-radio-panel" role="dialog" aria-label="Term of the day">
                    <div className="lp-radio-panel-head">
                        <span className="lp-radio-head">TERM OF THE DAY</span>
                        <button
                            type="button"
                            className="lp-radio-close"
                            onClick={() => setOpen(false)}
                            aria-label="Close"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    <h3 className="lp-radio-term">{term.title}</h3>
                    <p className="lp-radio-def">{term.meaning}</p>
                    {term.example && (
                        <p className="lp-radio-example">
                            <span>ON TRACK — </span>
                            {term.example}
                        </p>
                    )}

                    <Link
                        to={`/dictionary/${term.slug}`}
                        className="lp-cta lp-radio-link"
                        onClick={() => setOpen(false)}
                    >
                        EXPLORE F1 DICTIONARY <span aria-hidden="true">→</span>
                    </Link>
                </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════
 * Quick-navigation grid — every tile links to a real route.
 * ══════════════════════════════════════════════════════════════════ */

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

function ExploreGrid() {
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

/* ══════════════════════════════════════════════════════════════════
 * Site footer. Calm and typographic. Rendered only on the landing
 * page.
 * ══════════════════════════════════════════════════════════════════ */

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

function GarageFooter({ isAuthenticated }) {
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

/* ══════════════════════════════════════════════════════════════════
 * PAGE
 * ══════════════════════════════════════════════════════════════════ */

const SEASON = 2026;

function LandingPage() {
    const [races, setRaces] = useState([]);
    const [scheduleError, setScheduleError] = useState(false);
    const [user, setUser] = useState(null);
    const [driverStandings, setDriverStandings] = useState([]);
    const [constructorStandings, setConstructorStandings] = useState([]);
    const [latestRace, setLatestRace] = useState(null);
    const [newsArticles, setNewsArticles] = useState([]);
    const [newsError, setNewsError] = useState(false);

    /* re-evaluated every minute so a session flips to LIVE without a reload */
    const [minuteTick, setMinuteTick] = useState(0);

    const footerWrapRef = useRef(null);

    useEffect(() => {
        fetch(`${API}/grandprixdashboard/${SEASON}`)
            .then((res) => res.json())
            .then((data) => setRaces(Array.isArray(data) ? data : []))
            .catch(() => setScheduleError(true));
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;
        fetch(`${API}/user/profile`, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => data && !data.message && setUser(data))
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetch(`${API}/drivers/standings/${SEASON}`)
            .then((res) => res.json())
            .then((data) => setDriverStandings(Array.isArray(data) ? data : []))
            .catch(() => setDriverStandings([]));
    }, []);

    useEffect(() => {
        fetch(`${API}/teams/standings/${SEASON}`)
            .then((res) => res.json())
            .then((data) => setConstructorStandings(Array.isArray(data) ? data : []))
            .catch(() => setConstructorStandings([]));
    }, []);

    useEffect(() => {
        fetch(`${API}/grandprixdashboard/latest`)
            .then((res) => res.json())
            .then((data) => data?.raceName && setLatestRace(data))
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetch(`${API}/news`)
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) setNewsArticles(data);
                else setNewsError(true);
            })
            .catch(() => setNewsError(true));
    }, []);

    useEffect(() => {
        const id = setInterval(() => setMinuteTick((t) => t + 1), 60000);
        return () => clearInterval(id);
    }, []);

    /* minuteTick is a deliberate extra dependency: these values depend on
       the current time, so they are re-derived once a minute */
    const { liveSession, nextSession } = useMemo(
        () => ({
            liveSession: findLiveSession(races),
            nextSession: findNextSession(races),
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [races, minuteTick]
    );
    const favs = useMemo(() => buildFavourites(user), [user]);

    const isAuthenticated = Boolean(localStorage.getItem("token"));

    return (
        <div className="lp">
            <Hero />

            <NextGrandPrix
                liveSession={liveSession}
                nextSession={nextSession}
                scheduleError={scheduleError}
            />

            <GridInvite isAuthenticated={isAuthenticated} />

            <PlatformOverview />

            <RaceIntelligence race={latestRace} />

            <ChampionshipSection
                driverStandings={driverStandings}
                constructorStandings={constructorStandings}
                favs={favs}
            />

            <PaddockNews articles={newsArticles} favs={favs} error={newsError} />

            <ExploreGrid />

            <div ref={footerWrapRef}>
                <GarageFooter isAuthenticated={isAuthenticated} />
            </div>

            <PitWallRadio user={user} favs={favs} footerRef={footerWrapRef} />
        </div>
    );
}

export default LandingPage;
