import { Link } from "react-router-dom";
import DifficultyBadge from "./DifficultyBadge";
import CategoryIcon from "./CategoryIcon";
import { getCategoryIcon } from "../../utils/dictionaryHelpers";

function TermCard({ term, compact = false }) {
  return (
    <Link to={`/dictionary/${term.slug}`} className={`fd-term-card${compact ? " fd-term-card-compact" : ""}`}>
      <div className="fd-term-card-top">
        <span className="fd-term-icon">
          <CategoryIcon name={getCategoryIcon(term.category)} size={20} />
        </span>
        <DifficultyBadge level={term.difficulty} />
      </div>
      <h3 className="fd-term-title">{term.title}</h3>
      <span className="fd-term-category">{term.category}</span>
      {!compact && <p className="fd-term-desc">{term.shortDescription}</p>}
    </Link>
  );
}

export default TermCard;
