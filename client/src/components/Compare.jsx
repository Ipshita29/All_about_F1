import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import useInViewOnce from "../hooks/useInViewOnce";
import { AnimatedNumber, LayeredImage } from "./EntityDetail";

/*
 * Shared building blocks behind the compact Compare Drivers / Compare
 * Teams modal (opened from the Drivers/Teams pages, next to the search
 * bar): the searchable entity picker, the pre-selection empty state, the
 * two stat-reading styles (neutral side-by-side vs. proportional bar),
 * and the modal shell itself.
 */

/* Searchable dropdown used by the Compare modal to pick a driver/
   constructor. Replaces the native <select> with a trigger styled like
   the rest of the .ex-field control row, opening a panel with a search
   box and a filtered, keyboard-navigable option list. */
export function EntitySelect({
    label,
    placeholder = "Select…",
    value,
    onChange,
    options,
    getId,
    getLabel,
    getSubLabel,
    searchPlaceholder = "Search…",
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [highlight, setHighlight] = useState(0);
    const rootRef = useRef(null);
    const triggerRef = useRef(null);
    const inputRef = useRef(null);

    /* reset search + highlight the moment the panel opens — state
       adjustment during render, per the React docs pattern */
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) {
            setQuery("");
            setHighlight(0);
        }
    }

    const selected = options.find((o) => getId(o) === value);
    const filtered = options.filter((o) =>
        getLabel(o).toLowerCase().includes(query.toLowerCase())
    );

    /* focus the search box the moment the panel opens */
    useEffect(() => {
        if (!open) return undefined;
        const id = requestAnimationFrame(() => inputRef.current?.focus());
        return () => cancelAnimationFrame(id);
    }, [open]);

    /* outside click + Escape close the panel */
    useEffect(() => {
        if (!open) return undefined;
        const onOutside = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === "Escape") {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };
        document.addEventListener("pointerdown", onOutside);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onOutside);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const commit = (opt) => {
        onChange(getId(opt));
        setOpen(false);
        triggerRef.current?.focus();
    };

    const onSearchKeyDown = (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, filtered.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[highlight]) commit(filtered[highlight]);
        }
    };

    return (
        <div className="ex-combo" ref={rootRef}>
            <button
                type="button"
                ref={triggerRef}
                className="ex-combo-trigger"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
            >
                <span className="ex-field-label">{label}</span>
                <span className="ex-combo-value">
                    {selected ? getLabel(selected) : placeholder}
                </span>
                <svg className="ex-combo-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {open && (
                <div className="ex-combo-panel" role="listbox">
                    <div className="ex-combo-search">
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            placeholder={searchPlaceholder}
                            onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
                            onKeyDown={onSearchKeyDown}
                        />
                    </div>
                    <div className="ex-combo-list">
                        {filtered.length === 0 ? (
                            <div className="ex-combo-empty">No match</div>
                        ) : (
                            filtered.map((opt, i) => (
                                <button
                                    key={getId(opt)}
                                    type="button"
                                    role="option"
                                    aria-selected={getId(opt) === value}
                                    className={`ex-combo-option${i === highlight ? " is-highlight" : ""}${getId(opt) === value ? " is-selected" : ""}`}
                                    onMouseEnter={() => setHighlight(i)}
                                    onClick={() => commit(opt)}
                                >
                                    <span className="ex-combo-option-label">{getLabel(opt)}</span>
                                    {getSubLabel && (
                                        <span className="ex-combo-option-sub">{getSubLabel(opt)}</span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* The pre-selection state inside the Compare modal. Rather than a blank
   canvas, it pre-renders the shape of the comparison to come — a rail
   per metric that mirrors CompareBar/CompareStat's own layout — so the
   modal reads as designed before anything is picked. */
export function CompareEmptyState({ eyebrow, title, description, metrics }) {
    return (
        <div className="cmp-empty">
            <div className="cmp-empty-copy">
                <span className="cmp-empty-eyebrow">{eyebrow}</span>
                <h2 className="cmp-empty-title">{title}</h2>
                <p className="cmp-empty-desc">{description}</p>
            </div>
            <ul className="cmp-empty-rails" aria-hidden="true">
                {metrics.map((m) => (
                    <li key={m} className="cmp-empty-rail">
                        <span className="cmp-empty-rail-label">{m}</span>
                        <span className="cmp-empty-rail-track">
                            <span className="cmp-empty-rail-fill" />
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function better(a, b, lowerIsBetter) {
    const n1 = parseFloat(a);
    const n2 = parseFloat(b);
    if (Number.isNaN(n1) || Number.isNaN(n2) || n1 === n2) return null;
    if (lowerIsBetter) return n1 < n2 ? "a" : "b";
    return n1 > n2 ? "a" : "b";
}

/* Neutral side-by-side reading of one metric — for values where a
   proportional bar would mislead (championship position, average
   finish/qualifying position: a smaller number is stronger, not a
   shorter bar). No colour, no "winner" label — only a subtle weight
   shift on the stronger figure, exactly the underlying value either way. */
export function CompareStat({ label, prefix = "", valueA, valueB, lowerIsBetter = false }) {
    const [ref, inView] = useInViewOnce({ threshold: 0.4 });
    const lead = better(valueA, valueB, lowerIsBetter);
    const hasA = valueA !== null && valueA !== undefined;
    const hasB = valueB !== null && valueB !== undefined;

    return (
        <div ref={ref} className="cmp-stat">
            <span className="cmp-stat-label">{label}</span>
            <div className="cmp-stat-row">
                <span className={`cmp-stat-val${lead === "a" ? " is-lead" : ""}`}>
                    {hasA ? <>{prefix}<AnimatedNumber value={valueA} play={inView} /></> : "—"}
                </span>
                <span className="cmp-stat-rule" aria-hidden="true" />
                <span className={`cmp-stat-val cmp-stat-val--right${lead === "b" ? " is-lead" : ""}`}>
                    {hasB ? <>{prefix}<AnimatedNumber value={valueB} play={inView} /></> : "—"}
                </span>
            </div>
            {!hasA && !hasB && <span className="cmp-stat-na">DATA NOT AVAILABLE</span>}
        </div>
    );
}

/* One large identity card at the top of the modal — the driver's/team's
   accent colour as an ambient gradient, an oversized translucent racing
   number sitting behind the artwork (drivers only; teams have no number,
   so their card leans on the logo instead), and the name/sub-label
   anchored at the foot. Falls back to a monogram when no cutout/logo
   resolves — never a random remote photo. */
function CompareCard({ visual, label, subLabel }) {
    const hasImage = Boolean(visual.imageCandidates?.length);
    const monogram = (
        <span className="cmp-card-monogram cmp-mono" aria-hidden="true">{visual.monogram}</span>
    );

    return (
        <div className="cmp-card" style={{ "--cmp-card-accent": visual.accent }}>
            {visual.number !== null && visual.number !== undefined && visual.number !== "" && (
                <span className="cmp-card-number cmp-mono" aria-hidden="true">{visual.number}</span>
            )}
            <div className="cmp-card-media" aria-hidden="true">
                {hasImage ? (
                    <LayeredImage
                        candidates={visual.imageCandidates}
                        alt=""
                        className="cmp-card-img"
                        fallback={monogram}
                    />
                ) : monogram}
            </div>
            <div className="cmp-card-foot">
                <span className="cmp-card-name">{label}</span>
                {subLabel && <span className="cmp-card-sub cmp-mono">{subLabel}</span>}
            </div>
        </div>
    );
}

/* The compact comparison modal, opened from the Drivers/Teams pages —
   two EntitySelect pickers, then two large identity cards and exactly
   six metrics (championships, wins, podiums, championship position,
   championship points, F1 debut/first season) once both sides are
   chosen. Generic over driver vs team via the same getter-prop pattern
   EntitySelect already uses: getMetrics(entity) supplies the six stats,
   getVisual(entity) supplies the card's accent colour, racing number
   (drivers only), image candidates and monogram fallback — each page
   wires its own data, never a second copy of driver/team lookup logic. */
const METRIC_PREVIEW = [
    "CHAMPIONSHIPS",
    "WINS",
    "PODIUMS",
    "CHAMPIONSHIP POSITION",
    "CHAMPIONSHIP POINTS",
    "F1 DEBUT",
];

export function CompareModal({
    open,
    onClose,
    title,
    entityLabel,
    searchPlaceholder,
    options,
    getId,
    getLabel,
    getSubLabel,
    getMetrics,
    getVisual,
    debutLabel = "F1 Debut / First Season",
}) {
    const [aId, setAId] = useState("");
    const [bId, setBId] = useState("");

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    const a = options.find((o) => getId(o) === aId);
    const b = options.find((o) => getId(o) === bId);
    const bothSelected = Boolean(a && b);
    const mA = bothSelected ? getMetrics(a) : null;
    const mB = bothSelected ? getMetrics(b) : null;

    return (
        <div className="cmp-modal-overlay" onClick={onClose}>
            <div className="cmp-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
                <div className="cmp-modal-head">
                    <h2 className="cmp-modal-title">{title}</h2>
                    <button type="button" className="cmp-modal-close" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className="cmp-modal-body">
                    <div className="cmp-controls">
                        <EntitySelect
                            label={`${entityLabel} 01`}
                            placeholder={`Select ${entityLabel.toLowerCase()}`}
                            searchPlaceholder={searchPlaceholder}
                            value={aId}
                            onChange={setAId}
                            options={options}
                            getId={getId}
                            getLabel={getLabel}
                            getSubLabel={getSubLabel}
                        />
                        <EntitySelect
                            label={`${entityLabel} 02`}
                            placeholder={`Select ${entityLabel.toLowerCase()}`}
                            searchPlaceholder={searchPlaceholder}
                            value={bId}
                            onChange={setBId}
                            options={options}
                            getId={getId}
                            getLabel={getLabel}
                            getSubLabel={getSubLabel}
                        />
                    </div>

                    {!bothSelected ? (
                        <CompareEmptyState
                            eyebrow="GETTING STARTED"
                            title="Build your comparison"
                            description="Select two to compare:"
                            metrics={METRIC_PREVIEW}
                        />
                    ) : (
                        <div className="cmp-result">
                            <div className="cmp-cards">
                                <CompareCard visual={getVisual(a)} label={getLabel(a)} subLabel={getSubLabel?.(a)} />
                                <CompareCard visual={getVisual(b)} label={getLabel(b)} subLabel={getSubLabel?.(b)} />
                            </div>
                            <div className="cmp-grid cmp-metrics">
                                <CompareStat label="Championships" valueA={mA.championships} valueB={mB.championships} />
                                <CompareStat label="Wins" valueA={mA.wins} valueB={mB.wins} />
                                <CompareStat label="Podiums" valueA={mA.podiums} valueB={mB.podiums} />
                                <CompareStat label="Championship Position" prefix="P" valueA={mA.position} valueB={mB.position} lowerIsBetter />
                                <CompareStat label="Championship Points" valueA={mA.points} valueB={mB.points} />
                                <CompareStat label={debutLabel} valueA={mA.debut} valueB={mB.debut} lowerIsBetter />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
