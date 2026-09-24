import { useEffect, useRef, useState } from "react";
import useInViewOnce from "../hooks/useInViewOnce";
import { AnimatedNumber } from "./EntityDetail";
import { LoadingSpinner } from "./UI";

/*
 * The Driver/Team Comparison pages' shared building blocks: the
 * searchable driver/constructor picker, the pre-selection empty state,
 * the two stat-reading styles (neutral side-by-side vs. proportional
 * bar), the "not yet selected" placeholder, and the round-by-round
 * timeline. Always used together on those two pages.
 */

/* Searchable dropdown used by Wheel to Wheel and Constructor Battle to
   pick a driver/constructor. Replaces the native <select> with a trigger
   styled like the rest of the .ex-field control row, opening a panel
   with a search box and a filtered, keyboard-navigable option list. */
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

/* The pre-selection state for both comparison pages. Rather than a blank
   canvas, it pre-renders the shape of the analysis to come — a rail per
   metric category that mirrors CompareBar/CompareStat's own layout — so
   the page reads as designed before anything is picked. */
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

/* Proportional two-row bar for count-style metrics (points, wins,
   podiums, poles) — bar length reads as "how much", which only makes
   sense when more genuinely means more. Neither bar is tinted by rank;
   Milano Red is reserved for the page's own accents. */
export function CompareBar({ label, a, b }) {
    const [ref, inView] = useInViewOnce({ threshold: 0.4 });
    const n1 = parseFloat(a.value);
    const n2 = parseFloat(b.value);
    const hasA = !Number.isNaN(n1);
    const hasB = !Number.isNaN(n2);
    const max = Math.max(hasA ? n1 : 0, hasB ? n2 : 0, 1);

    return (
        <div ref={ref} className="cmp-bar-group">
            <span className="cmp-bar-label">{label}</span>

            <div className="cmp-bar-row">
                <span className="cmp-bar-name">{a.name}</span>
                <span className="cmp-bar-track" aria-hidden="true">
                    <span
                        className="cmp-bar-fill cmp-bar-fill--a"
                        style={{ width: inView && hasA ? `${(n1 / max) * 100}%` : 0 }}
                    />
                </span>
                <span className="cmp-bar-val">{hasA ? <AnimatedNumber value={a.value} play={inView} /> : "—"}</span>
            </div>

            <div className="cmp-bar-row">
                <span className="cmp-bar-name">{b.name}</span>
                <span className="cmp-bar-track" aria-hidden="true">
                    <span
                        className="cmp-bar-fill cmp-bar-fill--b"
                        style={{ width: inView && hasB ? `${(n2 / max) * 100}%` : 0 }}
                    />
                </span>
                <span className="cmp-bar-val">{hasB ? <AnimatedNumber value={b.value} play={inView} /> : "—"}</span>
            </div>

            {!hasA && !hasB && <span className="cmp-stat-na">DATA NOT AVAILABLE</span>}
        </div>
    );
}

/* Stand-in for the not-yet-selected side once exactly one driver/team has
   been picked — an intentional placeholder, never a broken or empty card. */
export function PendingSlot({ label }) {
    return (
        <div className="cmp-pending" aria-hidden="true">
            <span className="cmp-pending-mark">?</span>
            <span className="cmp-pending-label">{label}</span>
        </div>
    );
}

/* Round-by-round comparison timeline shared by Driver and Team
   comparison — a vertical, scannable list rather than a wide table, so
   it collapses cleanly on mobile. Each page supplies its own per-round
   cell content (a single finishing position for a driver, two for a
   constructor). */
export function RaceTimeline({ rows, loading, error, labelA, labelB }) {
    if (loading) {
        return (
            <div className="cmp-timeline-loading">
                <LoadingSpinner />
            </div>
        );
    }

    if (error) {
        return <p className="cmp-stat-na">DATA NOT AVAILABLE</p>;
    }

    if (!rows.length) {
        return <p className="cmp-stat-na">NO ROUNDS COMPLETED YET THIS SEASON</p>;
    }

    return (
        <ol className="cmp-timeline">
            {rows.map((row) => (
                <li key={row.round} className="cmp-timeline-row">
                    <div className="cmp-timeline-round">
                        <span className="cmp-timeline-num">ROUND {String(row.round).padStart(2, "0")}</span>
                        <span className="cmp-timeline-name">{row.raceName}</span>
                    </div>
                    <div className="cmp-timeline-results">
                        <div className="cmp-timeline-cell">
                            <span className="cmp-timeline-who">{labelA}</span>
                            <span className="cmp-timeline-pos">{row.a}</span>
                        </div>
                        <div className="cmp-timeline-cell cmp-timeline-cell--b">
                            <span className="cmp-timeline-who">{labelB}</span>
                            <span className="cmp-timeline-pos">{row.b}</span>
                        </div>
                    </div>
                </li>
            ))}
        </ol>
    );
}
