/*
 * THE F1 ENGINEER'S HANDBOOK — the dictionary as a dedicated knowledge
 * product rather than a page of the site. Search leads the page and
 * surfaces a real preview as you type; a proper segmented control (not a
 * floating pill) sets the explanation depth; popular terms and categories
 * sit on a light editorial band; the term archive and Word of the Day
 * close the page.
 *
 * Category cards navigate to a dedicated /dictionary/category/:slug page
 * (see DictionaryCategory.jsx) instead of scrolling to a section further
 * down — the "Filter the Archive" band below is a separate, complementary
 * in-page filter for browsing everything without leaving the hub, so its
 * chips still just narrow the grid in place. Purely data-driven; no AI.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Dices, Sparkles, ArrowRight } from "lucide-react";
import TermCard from "../components/TermCard";
import RevealOnScroll from "../components/RevealOnScroll";
import CategoryIcon from "../components/CategoryIcon";
import ModeSwitch from "../components/ModeSwitch";
import SearchPreview from "../components/SearchPreview";
import HandbookMark from "../components/HandbookMark";
import { SearchInput } from "../components/Input";
import EmptyState from "../components/EmptyState";
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
          <h1 className="fd-hero-title">
            <span>The F1</span>
            <span>Engineer&rsquo;s</span>
            <span>Handbook</span>
          </h1>
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

      {/* ── Popular terms + categories (light band) ────────────────── */}
      <section className="fd-band fd-band--light">
        <div className="fd-band-inner">
          <p className="fd-section-title fd-mono">START HERE</p>
          <h2 className="fd-band-heading">Popular F1 Terms</h2>
          <ul className="fd-popular-list">
            {popularTerms.map((term, i) => (
              <li key={term.slug}>
                <button className="fd-popular-item" onClick={() => navigate(`/dictionary/${term.slug}`)}>
                  <span className="fd-popular-index fd-mono">{String(i + 1).padStart(2, "0")}</span>
                  <span className="fd-popular-title">{term.title}</span>
                  <span className="fd-popular-category fd-mono">{term.category}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="fd-band-inner">
          <p className="fd-section-title fd-mono">BROWSE BY DEPARTMENT</p>
          <div className="fd-category-grid">
            {categories.map((cat, i) => (
              <RevealOnScroll key={cat.name} index={i}>
                <Link
                  to={`/dictionary/category/${cat.slug}`}
                  className={`fd-category-card${i % 2 === 1 ? " fd-category-card--dark" : ""}`}
                >
                  <span className="fd-category-icon">
                    <CategoryIcon name={cat.icon} size={22} />
                  </span>
                  <h3 className="fd-category-title">{cat.chip}</h3>
                  <p>{cat.description}</p>
                  <div className="fd-category-footer">
                    <span className="fd-category-count fd-mono">{cat.count} TERMS</span>
                    <span className="fd-category-explore fd-mono">
                      EXPLORE <ArrowRight size={13} />
                    </span>
                  </div>
                </Link>
              </RevealOnScroll>
            ))}
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
