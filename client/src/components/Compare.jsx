import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import useInViewOnce from "../hooks/useInViewOnce";
import { AnimatedNumber } from "./EntityDetail";

/*
 * Shared building blocks behind the compact Compare Drivers / Compare
 * Teams modal (opened from the Drivers/Teams pages, next to the search
 * bar): the searchable entity picker, the pre-selection empty state, the
 * two large identity cards, the centered metric-row table, and the
 * modal shell itself.
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
   per metric — so the modal reads as designed before anything is picked. */
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

/* Standard WCAG relative-luminance check so card text always reads
   against the team's own colour — a light livery (Mercedes silver)
   gets near-black text, a dark one (Ferrari red) gets near-white,
   instead of hardcoding one text colour for every accent. */
function getContrastText(hex) {
    const clean = (hex || "").replace("#", "");
    if (clean.length !== 6) return "#f5f3ef";
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return luminance > 0.42 ? "#141414" : "#f5f3ef";
}

/* One large identity card at the top of the modal — solid in the
   driver's/team's own accent colour, so Ferrari red or Mercedes silver
   reads instantly without a logo. Drivers get their real racing number
   as an oversized, translucent mark filling the card (never behind a
   photo); teams have no number, so their card is just the colour and
   the name, centred. Text colour is computed per-card so it always
   holds contrast against that accent. */
function CompareCard({ visual, label, subLabel }) {
    const hasNumber = visual.number !== null && visual.number !== undefined && visual.number !== "";
    const textColor = getContrastText(visual.accent);

    return (
        <div
            className={`cmp-card${hasNumber ? "" : " cmp-card--plain"}`}
            style={{ "--cmp-card-accent": visual.accent, "--cmp-card-text": textColor }}
        >
            {hasNumber && (
                <span className="cmp-card-number cmp-mono" aria-hidden="true">{visual.number}</span>
            )}
            <div className="cmp-card-foot">
                <span className="cmp-card-name">{label}</span>
                {subLabel && <span className="cmp-card-sub cmp-mono">{subLabel}</span>}
            </div>
        </div>
    );
}

/* One row of the comparison table — the metric label sits in the
   middle, with each side's value immediately left/right of it, so the
   two numbers read as directly opposed rather than two separate
   columns. A stronger weight (not colour) marks the better figure;
   a missing value is a plain em dash, not a "data not available" block. */
function CompareMetricRow({ label, prefix = "", valueA, valueB, lowerIsBetter = false }) {
    const [ref, inView] = useInViewOnce({ threshold: 0.4 });
    const lead = better(valueA, valueB, lowerIsBetter);
    const hasA = valueA !== null && valueA !== undefined && valueA !== "";
    const hasB = valueB !== null && valueB !== undefined && valueB !== "";

    return (
        <div ref={ref} className="cmp-row">
            <span className={`cmp-row-val cmp-row-val--a${lead === "a" ? " is-lead" : ""}`}>
                {hasA ? <>{prefix}<AnimatedNumber value={valueA} play={inView} /></> : "—"}
            </span>
            <span className="cmp-row-label cmp-mono">{label}</span>
            <span className={`cmp-row-val cmp-row-val--b${lead === "b" ? " is-lead" : ""}`}>
                {hasB ? <>{prefix}<AnimatedNumber value={valueB} play={inView} /></> : "—"}
            </span>
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
                    <button type="button" className="cmp-modal-close" onClick={onClose} aria-label="Close comparison" title="Close">
                        <X size={20} strokeWidth={2.5} aria-hidden="true" />
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
                            <div className="cmp-metrics">
                                <CompareMetricRow label="Championships" valueA={mA.championships} valueB={mB.championships} />
                                <CompareMetricRow label="Wins" valueA={mA.wins} valueB={mB.wins} />
                                <CompareMetricRow label="Podiums" valueA={mA.podiums} valueB={mB.podiums} />
                                <CompareMetricRow label="Championship Position" prefix="P" valueA={mA.position} valueB={mB.position} lowerIsBetter />
                                <CompareMetricRow label="Championship Points" valueA={mA.points} valueB={mB.points} />
                                <CompareMetricRow label={debutLabel} valueA={mA.debut} valueB={mB.debut} lowerIsBetter />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
