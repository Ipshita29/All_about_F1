/*
 * THE F1 ENGINEER'S HANDBOOK — a single term, read as a briefing rather
 * than a card. Strong heading hierarchy with dividers instead of boxed
 * sections; an educational animation where one genuinely helps (DRS flap,
 * tyre wear, flags, undercut/overcut, pit stop); and the same Rookie /
 * Race Engineer switch as the hub, cross-fading between simplified and
 * technical explanations. The switch's gating is unchanged from before —
 * beginnerTip only renders in Rookie mode, whyItMatters only in Race
 * Engineer mode — only how each state is presented has changed. Related
 * terms are preserved, as is visited-term tracking. Purely data-driven —
 * no AI is used anywhere in the Dictionary.
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { DifficultyBadge, TermCard, CategoryIcon, ModeSwitch } from "../components/Dictionary";
import { EmptyState } from "../components/UI";
import {
  getBriefingMode,
  saveBriefingMode,
  getTermBySlug,
  getRelatedTerms,
  estimateReadingTime,
  markTermVisited,
  getCategoryIcon,
  POPULAR_SLUGS,
} from "../utils/dictionaryHelpers";
import "../styles/pages/F1Dictionary.css";

/* ══════════════════════════════════════════════════════════════════
 * Lightweight educational animations for the Pit Wall Briefing.
 * Pure SVG + CSS (classes live in F1Dictionary.css); each one demonstrates
 * the concept it accompanies — a DRS flap opening, tyre wear stages, a
 * waving marshal flag, a pit-stop wheel change, an undercut/overcut demo.
 * TermAnimation returns null when a term has no meaningful animation, so
 * nothing is decorated for decoration's sake. Only used on this page.
 * ══════════════════════════════════════════════════════════════════ */

function CarSide({ className = "" }) {
  return (
    <g className={className}>
      {/* floor + body */}
      <path d="M4 34 L20 34 Q24 26 34 25 L58 24 Q66 24 70 20 L78 20 Q84 20 86 25 L96 27 Q100 28 99 32 L98 34 L110 34 L110 38 L4 38 Z" fill="var(--surface-3)" />
      {/* halo + helmet */}
      <path d="M62 20 Q66 14 72 16" fill="none" stroke="var(--text-muted)" strokeWidth="2" />
      <circle cx="67" cy="21" r="3.4" fill="var(--accent)" />
      {/* wheels */}
      <circle cx="30" cy="36" r="8" fill="var(--surface-2)" stroke="var(--text-muted)" strokeWidth="1.4" />
      <circle cx="88" cy="36" r="8" fill="var(--surface-2)" stroke="var(--text-muted)" strokeWidth="1.4" />
      <circle cx="30" cy="36" r="2.4" fill="var(--text-muted)" />
      <circle cx="88" cy="36" r="2.4" fill="var(--text-muted)" />
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
        <line x1="10" y1="14" x2="10" y2="30" stroke="var(--text-muted)" strokeWidth="2" />
        {/* main plane */}
        <line x1="6" y1="26" x2="22" y2="26" stroke="var(--text-secondary)" strokeWidth="2.4" />
        {/* the DRS flap — rotates around its trailing edge */}
        <line x1="6" y1="19" x2="22" y2="19" stroke="var(--accent-text)" strokeWidth="2.6" className="fd-anim-drs-flap" />
        <text x="26" y="12" className="fd-anim-tag">DRS FLAP</text>
        {/* airflow lines that speed up when the flap is open */}
        <g className="fd-anim-airflow" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="4 5">
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
          <circle cx="34" cy="24" r="17" fill="var(--surface-2)" />
          <circle cx="34" cy="24" r="17" fill="none" stroke="var(--accent-text)" strokeWidth="3" className="fd-anim-tyre-tread" />
          <circle cx="34" cy="24" r="7.5" fill="none" stroke="var(--text-muted)" strokeWidth="2" />
        </g>
        <g className="fd-anim-tag-group">
          <text x="62" y="18" className="fd-anim-tag fd-anim-tyre-label-new">NEW — MAX GRIP</text>
          <text x="62" y="18" className="fd-anim-tag fd-anim-tyre-label-mid">WORN — LOSING PACE</text>
          <text x="62" y="18" className="fd-anim-tag fd-anim-tyre-label-old">THE CLIFF — BOX BOX</text>
        </g>
        <line x1="62" y1="26" x2="112" y2="26" stroke="var(--text-muted)" strokeWidth="1" />
        <rect x="62" y="23.5" height="5" width="50" fill="none" stroke="var(--text-muted)" strokeWidth="1" />
        <rect x="62" y="23.5" height="5" width="50" fill="var(--accent)" className="fd-anim-tyre-life" />
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
        <line x1="30" y1="6" x2="30" y2="44" stroke="var(--text-muted)" strokeWidth="2.4" />
        <g className="fd-anim-flag">
          {chequered ? (
            <>
              <path d="M30 8 Q46 5 62 8 Q78 11 92 8 L92 26 Q78 29 62 26 Q46 23 30 26 Z" fill="var(--color-cararra)" />
              <path d="M30 8 Q38 6.5 46 7 L46 16 Q38 15.5 30 17 Z M62 8 Q70 9.5 78 9 L78 18 Q70 18.5 62 17 Z M46 16 Q54 16.5 62 17 L62 26 Q54 25 46 25 Z M78 18 Q85 17.7 92 17 L92 26 Q85 27 78 27 Z" fill="var(--color-carbon)" />
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
        <line x1="8" y1="42" x2="112" y2="42" stroke="var(--text-muted)" strokeWidth="1.4" strokeDasharray="3 5" />
        {/* old wheel rolling out */}
        <g className="fd-anim-wheel-out">
          <circle cx="40" cy="30" r="11" fill="var(--surface-2)" stroke="var(--text-muted)" strokeWidth="1.6" />
          <circle cx="40" cy="30" r="4" fill="none" stroke="var(--text-muted)" strokeWidth="1.4" />
        </g>
        {/* new wheel rolling in */}
        <g className="fd-anim-wheel-in">
          <circle cx="40" cy="30" r="11" fill="var(--surface-2)" stroke="var(--accent-text)" strokeWidth="2" />
          <circle cx="40" cy="30" r="4" fill="none" stroke="var(--accent-text)" strokeWidth="1.6" />
        </g>
        {/* wheel gun */}
        <rect x="34" y="8" width="12" height="7" fill="var(--surface-3)" className="fd-anim-gun" />
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
        <line x1="4" y1="16" x2="116" y2="16" stroke="var(--text-muted)" strokeWidth="1.4" />
        <path d="M30 16 Q40 30 56 30 Q72 30 82 16" fill="none" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 4" />
        <text x="47" y="40" className="fd-anim-tag">PIT LANE</text>
        {/* rival stays out */}
        <circle r="4" fill="var(--text-secondary)" className="fd-anim-car-rival" />
        {/* our car dives into the pit and emerges ahead */}
        <circle r="4" fill="var(--accent-text)" className="fd-anim-car-hero" />
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
function TermAnimation({ term }) {
  if (!term) return null;
  const slug = term.slug || "";

  if (slug === "drs" || slug === "drs-zone") return <DrsDemo />;
  if (slug === "undercut") return <StrategyDemo />;
  if (slug === "overcut") return <StrategyDemo overcut />;
  if (slug === "pit-stop") return <PitStopDemo />;
  if (slug.includes("yellow-flag")) return <FlagDemo color="var(--warning)" label="yellow" />;
  if (slug.includes("red-flag")) return <FlagDemo color="var(--accent-text)" label="red" />;
  if (slug.includes("blue-flag")) return <FlagDemo color="#3b6ea5" label="blue" />;
  if (slug.includes("chequered") || slug.includes("checkered"))
    return <FlagDemo color="var(--color-cararra)" label="chequered" chequered />;
  if (term.category === "Tyres") return <TyreDemo />;

  return null;
}

function TermNotFound({ slug }) {
  const suggestions = POPULAR_SLUGS.slice(0, 3).map(getTermBySlug).filter(Boolean);
  const query = slug ? slug.replace(/-/g, " ") : "";

  return (
    <div className="fd-page">
      <div className="fd-term-page">
        <Link to="/dictionary" className="fd-back-link fd-mono">
          <ArrowLeft size={15} /> BACK TO THE HANDBOOK
        </Link>
        <EmptyState
          title="No term found"
          description={`We couldn't find a definition for "${query}".`}
          action={
            <div className="fd-chip-row">
              {suggestions.map((term) => (
                <Link key={term.slug} to={`/dictionary/${term.slug}`} className="fd-chip">
                  {term.title}
                </Link>
              ))}
            </div>
          }
        />
      </div>
    </div>
  );
}

function DictionaryTerm() {
  const { slug } = useParams();
  const term = getTermBySlug(slug);
  const [mode, setMode] = useState(getBriefingMode);

  useEffect(() => {
    if (term) markTermVisited(term.slug);
  }, [term]);

  if (!term) return <TermNotFound slug={slug} />;

  const changeMode = (m) => {
    setMode(m);
    saveBriefingMode(m);
  };

  const related = getRelatedTerms(term);
  const readingTime = estimateReadingTime(term);
  const expert = mode === "expert";

  return (
    <div className="fd-page">
      <div className="fd-term-page">
        <Link to="/dictionary" className="fd-back-link fd-mono">
          <ArrowLeft size={15} /> BACK TO THE HANDBOOK
        </Link>

        <article className="fd-folder">
          <header className="fd-folder-head">
            <span className="fd-term-header-icon">
              <CategoryIcon name={getCategoryIcon(term.category)} size={26} />
            </span>
            <div className="fd-folder-head-copy">
              <span className="fd-folder-tab fd-mono">{term.category}</span>
              <h1>{term.title}</h1>
              <div className="fd-term-meta-row">
                <DifficultyBadge level={term.difficulty} />
                <span className="fd-reading-time fd-mono">{readingTime} MIN READ</span>
              </div>
            </div>
          </header>

          <ModeSwitch mode={mode} onChange={changeMode} className="fd-term-mode" />

          <div className="fd-divider" aria-hidden="true" />

          {/* the two depths cross-fade via the key change */}
          <div className="fd-folder-body" key={mode}>
            <p className="fd-term-lead">{term.meaning}</p>

            {!expert && term.beginnerTip && (
              <div className="fd-term-section">
                <h2 className="fd-mono">In Simple Terms</h2>
                <p>{term.beginnerTip}</p>
              </div>
            )}

            {expert && term.whyItMatters && (
              <div className="fd-term-section">
                <h2 className="fd-mono">Race Engineer</h2>
                <p>{term.whyItMatters}</p>
              </div>
            )}

            <TermAnimation term={term} />

            {term.example && (
              <div className="fd-term-section">
                <h2 className="fd-mono">Seen On Track</h2>
                <p>{term.example}</p>
              </div>
            )}

            {term.funFact && (
              <div className="fd-term-section">
                <h2 className="fd-mono">Did You Know?</h2>
                <div className="fd-fun-fact">
                  <Sparkles size={18} className="fd-fun-fact-icon" />
                  <p>{term.funFact}</p>
                </div>
              </div>
            )}
          </div>
        </article>

        {related.length > 0 && (
          <div className="fd-term-section fd-related-section">
            <h2 className="fd-mono">Related Terms</h2>
            <div className="fd-related-grid">
              {related.map((rel) => (
                <TermCard key={rel.slug} term={rel} compact />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DictionaryTerm;
