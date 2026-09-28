/*
 * THE F1 ENGINEER'S HANDBOOK — the dictionary as a dedicated knowledge
 * product rather than a page of the site. Search leads the page and
 * surfaces a real preview as you type; a proper segmented control (not a
 * floating pill) sets the explanation depth; a horizontal ticker of
 * popular terms sits on a light editorial band; the featured term,
 * archive and its category filter chips close the page.
 *
 * getCategoriesWithCounts()/category data still feeds the "Filter the
 * Archive" chips below (an in-page filter, not navigation) and the
 * separate /dictionary/category/:slug page (DictionaryCategory.jsx) —
 * this hub just no longer has its own category card grid linking there.
 * Purely data-driven; no AI.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Dices, Sparkles, ArrowRight } from "lucide-react";
import { TermCard, ModeSwitch } from "../components/Dictionary";
import { SearchInput, EmptyState } from "../components/UI";
import {
  getBriefingMode,
  saveBriefingMode,
  getAllTerms,
  getCategoriesWithCounts,
  getTermBySlug,
  getRandomTerm,
  getWordOfTheDay,
  matchesSearch,
  getEasterEgg,
  getProgress,
  POPULAR_SLUGS,
  SEARCH_PLACEHOLDERS,
  DID_YOU_KNOW_FACTS,
} from "../utils/dictionaryHelpers";
import "../styles/pages/F1Dictionary.css";

/* Fades + lifts children into view the first time they cross the
   viewport, staggered by `index` so grids reveal sequentially instead of
   popping in at once. Only used on this page. */
function RevealOnScroll({ index = 0, className = "", children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`fd-reveal ${visible ? "fd-reveal-visible" : ""} ${className}`}
      style={{ transitionDelay: `${Math.min(index, 10) * 40}ms` }}
    >
      {children}
    </div>
  );
}

/* The Dictionary's one recurring visual motif — a technical racing-line
   annotation, not F1 photography. Only used on this page. */
function HandbookMark({ className = "" }) {
  return (
    <svg
      className={`fd-mark${className ? ` ${className}` : ""}`}
      viewBox="0 0 220 220"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="fd-mark-line"
        d="M8 170 Q40 60 96 52 Q140 46 150 90 Q158 126 200 118"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="5 6"
      />
      <circle cx="96" cy="52" r="3" fill="currentColor" />
      <circle cx="150" cy="90" r="3" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1">
        <circle cx="200" cy="118" r="14" />
        <line x1="186" y1="118" x2="214" y2="118" />
        <line x1="200" y1="104" x2="200" y2="132" />
      </g>
      <text x="100" y="42" className="fd-mark-tag">APEX</text>
      <text x="154" y="112" className="fd-mark-tag">T2</text>
    </svg>
  );
}

/* The live result beneath the hero search field — reads the query and
   shows the closest real term immediately, in the same simple/technical
   shape the term page itself uses, entirely from existing dictionary
   fields (no invented copy). Only used on this page. */
function SearchPreview({ term, matchCount }) {
  if (!term) return null;

  return (
    <div className="fd-preview">
      <div className="fd-preview-head">
        <span className="fd-preview-category fd-mono">{term.category}</span>
        <h2 className="fd-preview-title">{term.title}</h2>
      </div>

      <p className="fd-preview-meaning">{term.meaning}</p>

      {term.beginnerTip && (
        <div className="fd-preview-block">
          <span className="fd-preview-label fd-mono">IN SIMPLE TERMS</span>
          <p>{term.beginnerTip}</p>
        </div>
      )}

      {term.whyItMatters && (
        <div className="fd-preview-block">
          <span className="fd-preview-label fd-mono">RACE ENGINEER</span>
          <p>{term.whyItMatters}</p>
        </div>
      )}

      <Link to={`/dictionary/${term.slug}`} className="fd-preview-open fd-mono">
        OPEN THE FULL FILE <ArrowRight size={13} />
      </Link>

      {matchCount > 1 && (
        <p className="fd-preview-more fd-mono">
          +{matchCount - 1} MORE MATCH{matchCount - 1 === 1 ? "" : "ES"} BELOW
        </p>
      )}
    </div>
  );
}

function F1Dictionary() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [progress] = useState(getProgress());
  const [fact] = useState(() => DID_YOU_KNOW_FACTS[Math.floor(Math.random() * DID_YOU_KNOW_FACTS.length)]);
  const [mode, setMode] = useState(getBriefingMode);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % SEARCH_PLACEHOLDERS.length);
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  const changeMode = (m) => {
    setMode(m);
    saveBriefingMode(m);
  };

  const allTerms = getAllTerms();
  const categories = getCategoriesWithCounts();
  const popularTerms = POPULAR_SLUGS.map(getTermBySlug).filter(Boolean);
  const easterEgg = getEasterEgg(search);
  const wotd = useMemo(() => getWordOfTheDay(), []);

  const filteredTerms = useMemo(
    () =>
      allTerms.filter(
        (term) => matchesSearch(term, search) && (activeCategory === "All" || term.category === activeCategory)
      ),
    [allTerms, search, activeCategory]
  );

  const searchMatches = useMemo(
    () => (search.trim() ? allTerms.filter((term) => matchesSearch(term, search)) : []),
    [allTerms, search]
  );

  const handleRandomTerm = () => {
    navigate(`/dictionary/${getRandomTerm().slug}`);
  };

  const docNumber = String(
    (allTerms.findIndex((t) => t.slug === wotd.slug) + 1) * 7
  ).padStart(3, "0");

  return (
    <div className="fd-page">
      {/* ── Hero: editorial intro + search + explanation-level control ── */}
      <section className="fd-hero">
        <HandbookMark className="fd-hero-mark" />
        <div className="fd-hero-content">
          <span className="fd-hero-eyebrow fd-mono">F1 · KNOWLEDGE</span>
          <h1 className="fd-hero-title">The F1 Engineer&rsquo;s Handbook</h1>
          <p className="fd-hero-sub">
            Understand the language, strategy and technology behind every Grand Prix.
          </p>

          <div className="fd-search-row">
            <div className="fd-search-wrap">
              <SearchInput
                placeholder={SEARCH_PLACEHOLDERS[placeholderIndex]}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search F1 terms, concepts, strategies"
                className="fd-search-input"
              />
              {easterEgg && (
                <div className="fd-easter-egg">
                  <Sparkles size={16} />
                  {easterEgg}
                </div>
              )}
            </div>

            <ModeSwitch mode={mode} onChange={changeMode} className="fd-hero-mode" />
          </div>

          {search.trim() && (
            searchMatches.length > 0 ? (
              <SearchPreview term={searchMatches[0]} matchCount={searchMatches.length} />
            ) : (
              <EmptyState
                className="fd-search-empty"
                title="No term found"
                description={`We couldn't find a definition for "${search.trim()}".`}
                action={
                  <div className="fd-chip-row">
                    {popularTerms.slice(0, 3).map((term) => (
                      <button key={term.slug} className="fd-chip" onClick={() => navigate(`/dictionary/${term.slug}`)}>
                        {term.title}
                      </button>
                    ))}
                  </div>
                }
              />
            )
          )}
        </div>
      </section>

      {/* ── Popular terms — a slow, seamless horizontal ticker (light
         band). The track renders popularTerms twice back to back and
         animates exactly -50%, so the loop point is invisible; the
         second copy is aria-hidden so assistive tech only hears the
         list once. Same popularTerms data as before, just presented as
         a ticker instead of a vertical list. ─────────────────────── */}
      <section className="fd-band fd-band--light">
        <div className="fd-band-inner">
          <p className="fd-section-title fd-mono">START HERE</p>
          <h2 className="fd-band-heading">Popular F1 Terms</h2>
          <div className="fd-ticker">
            <div className="fd-ticker-track">
              {[...popularTerms, ...popularTerms].map((term, i) => (
                <span className="fd-ticker-item" key={`${term.slug}-${i}`} aria-hidden={i >= popularTerms.length || undefined}>
                  <button
                    type="button"
                    className="fd-ticker-term"
                    tabIndex={i >= popularTerms.length ? -1 : undefined}
                    onClick={() => navigate(`/dictionary/${term.slug}`)}
                  >
                    {term.title}
                  </button>
                  <span className="fd-ticker-sep" aria-hidden="true">·</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Term exploration: word of the day + toolkit (dark band) ── */}
      <section className="fd-band fd-band--dark">
        <div className="fd-band-inner">
          <p className="fd-section-title fd-mono">FEATURED TERM</p>
          <Link to={`/dictionary/${wotd.slug}`} className="fd-wotd">
            <div className="fd-wotd-head fd-mono">
              <span>DOC. {docNumber}</span>
              <span className="fd-wotd-stamp">WORD OF THE DAY</span>
            </div>
            <h3 className="fd-wotd-title">{wotd.title}</h3>
            <p className="fd-wotd-meta fd-mono">
              {wotd.category?.toUpperCase()} · {wotd.difficulty?.toUpperCase()}
            </p>
            <p className="fd-wotd-desc">
              {mode === "expert" && wotd.whyItMatters ? wotd.whyItMatters : wotd.meaning}
            </p>
            <span className="fd-wotd-open fd-mono">
              OPEN THE FULL FILE <ArrowRight size={12} />
            </span>
          </Link>
        </div>

        <div className="fd-band-inner">
          <div className="fd-toolkit-grid">
            <div className="fd-toolkit-card">
              <span className="fd-toolkit-label fd-mono">LEARNING PROGRESS</span>
              <p className="fd-progress-count">
                {progress.visited} / {progress.total} CONCEPTS
              </p>
              <div className="fd-progress-track">
                <div
                  className="fd-progress-fill"
                  style={{ width: `${Math.min(100, (progress.visited / progress.total) * 100)}%` }}
                />
              </div>
            </div>

            <div className="fd-toolkit-card">
              <span className="fd-toolkit-label fd-mono">DID YOU KNOW?</span>
              <p className="fd-fact-text">{fact}</p>
            </div>

            <div className="fd-toolkit-card">
              <span className="fd-toolkit-label fd-mono">FEELING CURIOUS?</span>
              <button className="fd-random-btn" onClick={handleRandomTerm}>
                <Dices size={16} /> Random Term
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Filters + term archive (light band) ─────────────────────── */}
      <section className="fd-band fd-band--light">
        <div className="fd-band-inner">
          <p className="fd-section-title fd-mono">FILTER THE ARCHIVE</p>
          <div className="fd-chip-row">
            <button
              className={`fd-chip${activeCategory === "All" ? " fd-chip-active" : ""}`}
              onClick={() => setActiveCategory("All")}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.name}
                className={`fd-chip${activeCategory === cat.name ? " fd-chip-active" : ""}`}
                onClick={() => setActiveCategory(cat.name)}
              >
                {cat.chip}
              </button>
            ))}
          </div>

          <div className="fd-grid-header">
            <h2 className="fd-band-heading" style={{ marginBottom: 0 }}>
              {activeCategory === "All" ? "All Terms" : activeCategory}
            </h2>
            <span className="fd-grid-count fd-mono">
              {filteredTerms.length} TERM{filteredTerms.length !== 1 ? "S" : ""}
            </span>
          </div>

          {filteredTerms.length > 0 ? (
            <div className="fd-term-grid">
              {filteredTerms.map((term, i) => (
                <RevealOnScroll key={term.slug} index={i % 12}>
                  <TermCard term={term} onLight />
                </RevealOnScroll>
              ))}
            </div>
          ) : (
            <EmptyState
              onLight
              title="No term found"
              description={
                search.trim()
                  ? `We couldn't find a definition for "${search.trim()}".`
                  : "Nothing matches this filter — try another category."
              }
              action={
                <div className="fd-chip-row">
                  {popularTerms.slice(0, 3).map((term) => (
                    <button key={term.slug} className="fd-chip" onClick={() => navigate(`/dictionary/${term.slug}`)}>
                      {term.title}
                    </button>
                  ))}
                </div>
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}

export default F1Dictionary;
