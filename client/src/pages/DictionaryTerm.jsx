/*
 * THE F1 ENGINEER'S HANDBOOK — a single term, read as a briefing rather
 * than a card. Strong heading hierarchy with dividers instead of boxed
 * sections; an educational animation where one genuinely helps (DRS flap,
 * tyre wear, flags, undercut/overcut, pit stop); and the same Rookie /
 * Race Engineer switch as the hub, cross-fading between simplified and
 * technical explanations. The switch's gating is unchanged from before —
 * beginnerTip only renders in Rookie mode, whyItMatters only in Race
 * Engineer mode — only how each state is presented has changed. Related
 * terms and the AI coach are preserved, as is visited-term tracking.
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import DifficultyBadge from "../components/dictionary/DifficultyBadge";
import AICoach from "../components/dictionary/AICoach";
import TermCard from "../components/dictionary/TermCard";
import CategoryIcon from "../components/dictionary/CategoryIcon";
import TermAnimation from "../components/dictionary/TermAnimation";
import ModeSwitch from "../components/dictionary/ModeSwitch";
import EmptyState from "../components/ui/EmptyState";
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
import "./F1Dictionary.css";

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

        <AICoach termTitle={term.title} />

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
