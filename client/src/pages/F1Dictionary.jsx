import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dices, Sparkles, SearchX, ArrowRight } from "lucide-react";
import TermCard from "../components/dictionary/TermCard";
import RevealOnScroll from "../components/dictionary/RevealOnScroll";
import CategoryIcon from "../components/dictionary/CategoryIcon";
import {
  getAllTerms,
  getCategoriesWithCounts,
  getTermBySlug,
  getRandomTerm,
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

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % SEARCH_PLACEHOLDERS.length);
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  const allTerms = getAllTerms();
  const categories = getCategoriesWithCounts();
  const popularTerms = POPULAR_SLUGS.map(getTermBySlug).filter(Boolean);
  const easterEgg = getEasterEgg(search);

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

  return (
    <div className="fd-page">
      <section className="fd-hero">
        <div className="fd-hero-content">
          <h1>
            Formula 1 <span className="fd-hero-accent">Dictionary</span>
          </h1>
          <p className="fd-hero-sub">
            Learn every Formula 1 concept, from beginner basics to advanced race strategy.
          </p>
          <div className="fd-search-wrap">
            <input
              type="text"
              className="fd-search-input"
              placeholder={SEARCH_PLACEHOLDERS[placeholderIndex]}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {easterEgg && (
              <div className="fd-easter-egg">
                <Sparkles size={16} />
                {easterEgg}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="fd-section">
        <p className="fd-section-title">Popular Terms</p>
        <div className="fd-chip-row">
          {popularTerms.map((term) => (
            <button key={term.slug} className="fd-chip" onClick={() => navigate(`/dictionary/${term.slug}`)}>
              {term.title}
            </button>
          ))}
        </div>
      </section>

      <section className="fd-section">
        <p className="fd-section-title">Categories</p>
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
      </section>

      <section className="fd-section">
        <p className="fd-section-title">Explore By Category</p>
        <div className="fd-category-grid">
          {categories.map((cat, i) => (
            <RevealOnScroll key={cat.name} index={i}>
              <button className="fd-category-card" onClick={() => handleCategorySelect(cat.name)}>
                <span className="fd-category-icon">
                  <CategoryIcon name={cat.icon} size={24} />
                </span>
                <h3>{cat.chip}</h3>
                <p>{cat.description}</p>
                <div className="fd-category-footer">
                  <span className="fd-category-count">{cat.count} Terms</span>
                  <span className="fd-category-explore">
                    Explore <ArrowRight size={13} />
                  </span>
                </div>
              </button>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      <section className="fd-section">
        <div className="fd-toolkit-grid">
          <div className="fd-toolkit-card">
            <span className="fd-toolkit-label">Learning Progress</span>
            <p className="fd-progress-count">
              {progress.visited} / {progress.total} Concepts
            </p>
            <div className="fd-progress-track">
              <div
                className="fd-progress-fill"
                style={{ width: `${Math.min(100, (progress.visited / progress.total) * 100)}%` }}
              />
            </div>
          </div>

          <div className="fd-toolkit-card">
            <span className="fd-toolkit-label">Did You Know?</span>
            <p className="fd-fact-text">{fact}</p>
          </div>

          <div className="fd-toolkit-card">
            <span className="fd-toolkit-label">Feeling Curious?</span>
            <button className="fd-random-btn" onClick={handleRandomTerm}>
              <Dices size={16} /> Explore Random Term
            </button>
          </div>
        </div>
      </section>

      <section className="fd-section" ref={gridRef}>
        <div className="fd-grid-header">
          <p className="fd-section-title" style={{ marginBottom: 0 }}>
            {activeCategory === "All" ? "All Terms" : activeCategory}
          </p>
          <span className="fd-grid-count">
            {filteredTerms.length} term{filteredTerms.length !== 1 ? "s" : ""}
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
            <h3>No terms in the pits</h3>
            <p>Nothing matches your search — try another term or clear the filters.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default F1Dictionary;
