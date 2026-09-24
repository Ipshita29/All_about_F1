import { useEffect, useRef, useState } from "react";

/*
 * Searchable dropdown used by Wheel to Wheel and Constructor Battle to pick
 * a driver/constructor. Replaces the native <select> with a trigger styled
 * like the rest of the .ex-field control row, opening a panel with a search
 * box and a filtered, keyboard-navigable option list.
 */
function EntitySelect({
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

export default EntitySelect;
