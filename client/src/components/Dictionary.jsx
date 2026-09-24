import { Link } from "react-router-dom";
import { Flag, Brain, Disc, Car, Calendar, Timer, Users, Trophy, Map, CloudRain, BookOpen } from "lucide-react";
import { getCategoryIcon } from "../utils/dictionaryHelpers";

/*
 * Shared pieces for the F1 Dictionary feature (hub, category and term
 * pages): a category icon lookup, the difficulty badge, the Rookie/Race
 * Engineer segmented control, and the term card used in every listing.
 */

const ICONS = {
    Flag,
    Brain,
    Disc,
    Car,
    Calendar,
    Timer,
    Users,
    Trophy,
    Map,
    CloudRain,
    BookOpen,
};

export function CategoryIcon({ name, size = 22, className = "" }) {
    const Icon = ICONS[name] || Flag;
    return <Icon size={size} className={className} />;
}

export function DifficultyBadge({ level }) {
    if (!level) return null;
    const cls = level.toLowerCase();
    return <span className={`fd-badge fd-badge-${cls}`}>{level}</span>;
}

/* Explanation-level segmented control — Rookie / Race Engineer. A proper
   two-cell segmented control: equal-height cells, a shared border, the
   active cell filled with a light surface and marked with a small Milano
   Red indicator dot. Same getBriefingMode/saveBriefingMode contract. */
const MODE_OPTIONS = [
    { value: "beginner", label: "ROOKIE" },
    { value: "expert", label: "RACE ENGINEER" },
];

export function ModeSwitch({ mode, onChange, label = "EXPLANATION LEVEL", className = "" }) {
    return (
        <div className={`fd-mode${className ? ` ${className}` : ""}`}>
            <span className="fd-mode-label fd-mono">{label}</span>
            <div className="fd-mode-track" role="group" aria-label={label}>
                {MODE_OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        aria-pressed={mode === opt.value}
                        className={`fd-mode-btn${mode === opt.value ? " fd-mode-btn-active" : ""}`}
                        onClick={() => onChange(opt.value)}
                    >
                        {mode === opt.value && <span className="fd-mode-dot" aria-hidden="true" />}
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function TermCard({ term, compact = false, onLight = false }) {
    return (
        <Link
            to={`/dictionary/${term.slug}`}
            className={`fd-term-card${compact ? " fd-term-card-compact" : ""}${onLight ? " fd-term-card--on-light" : ""}`}
        >
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
