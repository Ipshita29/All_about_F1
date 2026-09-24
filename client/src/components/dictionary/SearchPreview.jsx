import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/*
 * The live result beneath the hero search field — reads the query and
 * shows the closest real term immediately, in the same simple/technical
 * shape the term page itself uses, entirely from existing dictionary
 * fields (no invented copy).
 */
export default function SearchPreview({ term, matchCount }) {
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
