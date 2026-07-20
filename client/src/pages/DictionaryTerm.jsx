/*
 * PIT WALL BRIEFING — one term, opened like an engineer's folder.
 *
 * The page unfolds as a technical file: header tab, clearance stamps, the
 * briefing itself, an educational animation where one genuinely helps
 * (DRS flap, tyre wear, flags, undercut/overcut, pit stop), and a Rookie /
 * Race Engineer switch that cross-fades between simplified and technical
 * explanations without leaving the page. Related files and the AI coach
 * are preserved from the previous version, as is visited-term tracking.
 */
import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import DifficultyBadge from "../components/dictionary/DifficultyBadge";
import AICoach from "../components/dictionary/AICoach";
import TermCard from "../components/dictionary/TermCard";
import CategoryIcon from "../components/dictionary/CategoryIcon";
import TermAnimation from "../components/dictionary/TermAnimation";
import ModeSwitch from "../components/dictionary/ModeSwitch";
import {
  getBriefingMode,
  saveBriefingMode,
  getTermBySlug,
  getRelatedTerms,
  estimateReadingTime,
  markTermVisited,
  getCategoryIcon,
} from "../utils/dictionaryHelpers";
import "./F1Dictionary.css";

function DictionaryTerm() {
  const { slug } = useParams();
  const term = getTermBySlug(slug);
  const [mode, setMode] = useState(getBriefingMode);

  useEffect(() => {
    if (term) markTermVisited(term.slug);
  }, [term]);

  if (!term) return <Navigate to="/dictionary" replace />;

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
          <ArrowLeft size={15} /> BACK TO THE BRIEFING ROOM
        </Link>

        {/* ── The folder ─────────────────────────────────────────── */}
        <article className="fd-folder">
          <div className="fd-folder-tab fd-mono" aria-hidden="true">
            FILE — {term.category?.toUpperCase()}
          </div>

          <header className="fd-folder-head">
            <span className="fd-term-header-icon">
              <CategoryIcon name={getCategoryIcon(term.category)} size={30} />
            </span>
            <div className="fd-folder-head-copy">
              <h1>{term.title}</h1>
              <div className="fd-term-meta-row">
                <span className="fd-term-category-badge">{term.category}</span>
                <DifficultyBadge level={term.difficulty} />
                <span className="fd-reading-time fd-mono">{readingTime} MIN READ</span>
              </div>
            </div>
            <ModeSwitch mode={mode} onChange={changeMode} />
          </header>

          <div className="fd-divider" aria-hidden="true" />

          {/* the two depths cross-fade via the key change */}
          <div className="fd-folder-body" key={mode}>
            <div className="fd-term-section">
              <h2 className="fd-mono">{expert ? "TECHNICAL BRIEF" : "THE BRIEFING"}</h2>
              <p>{term.meaning}</p>
            </div>

            <TermAnimation term={term} />

            {!expert && term.beginnerTip && (
              <div className="fd-tip-callout">
                <strong className="fd-mono">ROOKIE NOTE</strong>
                <p>{term.beginnerTip}</p>
              </div>
            )}

            {expert && term.whyItMatters && (
              <div className="fd-term-section">
                <h2 className="fd-mono">WHY THE PIT WALL CARES</h2>
                <p>{term.whyItMatters}</p>
              </div>
            )}

            {expert && term.example && (
              <div className="fd-term-section">
                <h2 className="fd-mono">CASE STUDY — REAL RACE</h2>
                <p>{term.example}</p>
              </div>
            )}

            {!expert && term.example && (
              <div className="fd-term-section">
                <h2 className="fd-mono">SEEN IN A REAL RACE</h2>
                <p>{term.example}</p>
              </div>
            )}

            {term.funFact && (
              <div className="fd-term-section">
                <h2 className="fd-mono">DID YOU KNOW?</h2>
                <div className="fd-fun-fact">
                  <Sparkles size={18} className="fd-fun-fact-icon" />
                  <p>{term.funFact}</p>
                </div>
              </div>
            )}
          </div>
        </article>

        <AICoach termTitle={term.title} />

        {related.length > 0 && (
          <div className="fd-term-section fd-related-section">
            <h2 className="fd-mono">CROSS-REFERENCED FILES</h2>
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
