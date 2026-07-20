/*
 * PIT WALL BRIEFING — the F1 dictionary as an engineer's briefing room.
 *
 * Search leads the page, the Word of the Day is presented as a classified
 * technical bulletin, categories are briefing files, and every term opens
 * like a folder from the pit wall. A Beginner / Expert switch (shared with
 * the term page via localStorage) trades simplified language for technical
 * depth without leaving the page. All previous features are preserved:
 * search + rotating placeholders, easter eggs, popular terms, category
 * filters, learning progress, did-you-know facts and the random term.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Dices, Sparkles, SearchX, ArrowRight } from "lucide-react";
import TermCard from "../components/dictionary/TermCard";
import RevealOnScroll from "../components/dictionary/RevealOnScroll";
import CategoryIcon from "../components/dictionary/CategoryIcon";
import ModeSwitch from "../components/dictionary/ModeSwitch";
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
import "./F1Dictionary.css";

function F1Dictionary() {
  const navigate = useNavigate();
  const gridRef = useRef(null);

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

  const scrollToGrid = () => {
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCategorySelect = (name) => {
    setActiveCategory(name);
    scrollToGrid();
  };

  const handleRandomTerm = () => {
    navigate(`/dictionary/${getRandomTerm().slug}`);
  };

  const docNumber = String(
    (allTerms.findIndex((t) => t.slug === wotd.slug) + 1) * 7
  ).padStart(3, "0");

  return (
    <div className="fd-page">
      {/* ── Hero: search first ─────────────────────────────────────── */}
      <section className="fd-hero">
        <div className="fd-hero-content">
          <span className="fd-hero-eyebrow fd-mono">ALL ABOUT F1 · ENGINEER'S REFERENCE</span>
          <h1>PIT WALL BRIEFING</h1>
          <p className="fd-hero-sub fd-mono">
            EVERY CONCEPT IN THE SPORT, EXPLAINED FROM THE ENGINEER'S CHAIR
          </p>

          <div className="fd-search-wrap">
            <input
              type="text"
              className="fd-search-input"
              placeholder={SEARCH_PLACEHOLDERS[placeholderIndex]}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search the briefing"
            />
            <span className="fd-search-scanline" aria-hidden="true" />
            {easterEgg && (
              <div className="fd-easter-egg">
                <Sparkles size={16} />
                {easterEgg}
              </div>
            )}
          </div>

          <ModeSwitch mode={mode} onChange={changeMode} />
        </div>
      </section>

      {/* ── Word of the day: classified bulletin ───────────────────── */}
      <section className="fd-section">
        <Link to={`/dictionary/${wotd.slug}`} className="fd-wotd">
          <div className="fd-wotd-head fd-mono">
            <span>TECHNICAL BULLETIN · No. {docNumber}</span>
            <span className="fd-wotd-stamp">WORD OF THE DAY</span>
          </div>
          <div className="fd-wotd-body">
            <div className="fd-wotd-copy">
              <h2 className="fd-wotd-title">{wotd.title}</h2>
              <p className="fd-wotd-meta fd-mono">
                FILE — {wotd.category?.toUpperCase()} · CLEARANCE — {wotd.difficulty?.toUpperCase()}
              </p>
              <p className="fd-wotd-desc">
                {mode === "expert" && wotd.whyItMatters ? wotd.whyItMatters : wotd.meaning}
              </p>
              <span className="fd-wotd-open fd-mono">
                OPEN THE FULL FILE <ArrowRight size={12} />
              </span>
            </div>
            <div className="fd-wotd-side" aria-hidden="true">
              <span className="fd-wotd-classified fd-mono">DECLASSIFIED</span>
              <span className="fd-redact" />
              <span className="fd-redact fd-redact--short" />
              <span className="fd-redact" />
            </div>
          </div>
        </Link>
      </section>

      {/* ── Popular terms ──────────────────────────────────────────── */}
      <section className="fd-section">
        <p className="fd-section-title fd-mono">MOST REQUESTED FILES</p>
        <div className="fd-chip-row">
          {popularTerms.map((term) => (
            <button key={term.slug} className="fd-chip" onClick={() => navigate(`/dictionary/${term.slug}`)}>
              {term.title}
            </button>
          ))}
        </div>
      </section>

      {/* ── Category briefing files ────────────────────────────────── */}
      <section className="fd-section">
        <p className="fd-section-title fd-mono">BRIEFING FILES BY DEPARTMENT</p>
        <div className="fd-category-grid">
          {categories.map((cat, i) => (
            <RevealOnScroll key={cat.name} index={i}>
              <button className="fd-category-card" onClick={() => handleCategorySelect(cat.name)}>
                <span className="fd-category-tab fd-mono" aria-hidden="true">
                  FILE {String(i + 1).padStart(2, "0")}
                </span>
                <span className="fd-category-icon">
                  <CategoryIcon name={cat.icon} size={24} />
                </span>
                <h3>{cat.chip}</h3>
                <p>{cat.description}</p>
                <div className="fd-category-footer">
                  <span className="fd-category-count fd-mono">{cat.count} TERMS</span>
                  <span className="fd-category-explore fd-mono">
                    OPEN <ArrowRight size={13} />
                  </span>
                </div>
              </button>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* ── Toolkit ────────────────────────────────────────────────── */}
      <section className="fd-section">
        <div className="fd-toolkit-grid">
          <div className="fd-toolkit-card">
            <span className="fd-toolkit-label fd-mono">LEARNING TELEMETRY</span>
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
              <Dices size={16} /> PULL A RANDOM FILE
            </button>
          </div>
        </div>
      </section>

      {/* ── Filters + term folders ─────────────────────────────────── */}
      <section className="fd-section" ref={gridRef}>
        <p className="fd-section-title fd-mono">FILTER THE ARCHIVE</p>
        <div className="fd-chip-row">
          <button
            className={`fd-chip${activeCategory === "All" ? " fd-chip-active" : ""}`}
            onClick={() => handleCategorySelect("All")}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              className={`fd-chip${activeCategory === cat.name ? " fd-chip-active" : ""}`}
              onClick={() => handleCategorySelect(cat.name)}
            >
              {cat.chip}
            </button>
          ))}
        </div>

        <div className="fd-grid-header">
          <p className="fd-section-title fd-mono" style={{ marginBottom: 0 }}>
            {activeCategory === "All" ? "ALL FILES" : activeCategory.toUpperCase()}
          </p>
          <span className="fd-grid-count fd-mono">
            {filteredTerms.length} TERM{filteredTerms.length !== 1 ? "S" : ""}
          </span>
        </div>

        {filteredTerms.length > 0 ? (
          <div className="fd-term-grid">
            {filteredTerms.map((term, i) => (
              <RevealOnScroll key={term.slug} index={i % 12}>
                <TermCard term={term} />
              </RevealOnScroll>
            ))}
          </div>
        ) : (
          <div className="fd-empty-state">
            <SearchX size={40} className="fd-empty-state-icon" />
            <h3>NO FILES IN THE PITS</h3>
            <p>Nothing matches your search — try another term or clear the filters.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default F1Dictionary;
