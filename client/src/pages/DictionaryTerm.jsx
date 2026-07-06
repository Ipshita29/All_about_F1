import { useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import DifficultyBadge from "../components/dictionary/DifficultyBadge";
import AICoach from "../components/dictionary/AICoach";
import TermCard from "../components/dictionary/TermCard";
import CategoryIcon from "../components/dictionary/CategoryIcon";
import {
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

  useEffect(() => {
    if (term) markTermVisited(term.slug);
  }, [term]);

  if (!term) return <Navigate to="/dictionary" replace />;

  const related = getRelatedTerms(term);
  const readingTime = estimateReadingTime(term);

  return (
    <div className="fd-term-page">
      <Link to="/dictionary" className="fd-back-link">
        <ArrowLeft size={15} /> Back to Dictionary
      </Link>

      <span className="fd-term-header-icon">
        <CategoryIcon name={getCategoryIcon(term.category)} size={34} />
      </span>
      <h1>{term.title}</h1>

      <div className="fd-term-meta-row">
        <span className="fd-term-category-badge">{term.category}</span>
        <DifficultyBadge level={term.difficulty} />
        <span className="fd-reading-time">{readingTime} min read</span>
      </div>

      <div className="fd-divider" />

      <div className="fd-term-section">
        <h2>What Is It?</h2>
        <p>{term.meaning}</p>
      </div>

      {term.beginnerTip && (
        <div className="fd-tip-callout">
          <strong>Beginner Tip</strong>
          <p>{term.beginnerTip}</p>
        </div>
      )}

      {term.whyItMatters && (
        <div className="fd-term-section">
          <h2>Why Does It Matter?</h2>
          <p>{term.whyItMatters}</p>
        </div>
      )}

      {term.example && (
        <div className="fd-term-section">
          <h2>Real Race Example</h2>
          <p>{term.example}</p>
        </div>
      )}

      {term.funFact && (
        <div className="fd-term-section">
          <h2>Fun Fact</h2>
          <div className="fd-fun-fact">
            <Sparkles size={18} className="fd-fun-fact-icon" />
            <p>{term.funFact}</p>
          </div>
        </div>
      )}

      <AICoach termTitle={term.title} />

      {related.length > 0 && (
        <div className="fd-term-section">
          <h2>Related Terms</h2>
          <div className="fd-related-grid">
            {related.map((rel) => (
              <TermCard key={rel.slug} term={rel} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DictionaryTerm;
