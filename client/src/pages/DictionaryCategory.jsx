/*
 * A DEPARTMENT OF THE HANDBOOK — the term list for a single category.
 * Reached by clicking a category card on the Dictionary hub (a real
 * navigation, not a scroll-to-section); shows only that category's terms,
 * reusing the exact same TermCard used everywhere else in the Dictionary.
 * Purely data-driven — no invented copy, no AI.
 */
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import TermCard from "../components/TermCard";
import CategoryIcon from "../components/CategoryIcon";
import EmptyState from "../components/EmptyState";
import { getCategoryBySlug, getTermsByCategory, CATEGORY_INFO } from "../utils/dictionaryHelpers";
import "../styles/pages/F1Dictionary.css";

function CategoryNotFound() {
  return (
    <div className="fd-page">
      <div className="fd-term-page">
        <Link to="/dictionary" className="fd-back-link fd-mono">
          <ArrowLeft size={15} /> ALL DICTIONARY TERMS
        </Link>
        <EmptyState
          title="No category found"
          description="That department doesn't exist in the handbook."
          action={
            <div className="fd-chip-row">
              {CATEGORY_INFO.slice(0, 3).map((cat) => (
                <Link key={cat.slug} to={`/dictionary/category/${cat.slug}`} className="fd-chip">
                  {cat.chip}
                </Link>
              ))}
            </div>
          }
        />
      </div>
    </div>
  );
}

function DictionaryCategory() {
  const { categorySlug } = useParams();
  const category = getCategoryBySlug(categorySlug);

  if (!category) return <CategoryNotFound />;

  const terms = getTermsByCategory(category.name);

  return (
    <div className="fd-page">
      <section className="fd-band fd-band--dark">
        <div className="fd-band-inner">
          <Link to="/dictionary" className="fd-back-link fd-mono">
            <ArrowLeft size={15} /> ALL DICTIONARY TERMS
          </Link>

          <span className="fd-hero-eyebrow fd-mono">F1 DICTIONARY</span>
          <div className="fd-category-page-head">
            <span className="fd-category-page-icon">
              <CategoryIcon name={category.icon} size={26} />
            </span>
            <h1 className="fd-category-page-title">{category.chip}</h1>
          </div>
          <p className="fd-category-page-desc">{category.description}</p>
          <span className="fd-grid-count fd-mono">
            {terms.length} TERM{terms.length !== 1 ? "S" : ""}
          </span>
        </div>
      </section>

      <section className="fd-band fd-band--light">
        <div className="fd-band-inner">
          {terms.length > 0 ? (
            <div className="fd-term-grid">
              {terms.map((term) => (
                <TermCard key={term.slug} term={term} onLight />
              ))}
            </div>
          ) : (
            <EmptyState
              onLight
              title="No terms yet"
              description="This department doesn't have any terms in the handbook yet."
            />
          )}
        </div>
      </section>
    </div>
  );
}

export default DictionaryCategory;
