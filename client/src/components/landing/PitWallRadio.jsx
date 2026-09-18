/*
 * Floating "Term of the Day" chip — a quiet nudge toward the F1 Dictionary.
 * Replaces the old radio-transmission roleplay UI with a minimal tooltip.
 *
 * - Appears only after the visitor scrolls past the hero.
 * - Hides again while the footer is on screen (so it never covers it).
 * - The term comes from the existing dictionary data via getWordOfTheDay(),
 *   which already rotates deterministically once per day.
 * - Expanded panel closes on Escape, outside click, or the × button.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { getWordOfTheDay } from "../../utils/dictionaryHelpers";

export default function PitWallRadio({ favs, footerRef }) {
    const [term] = useState(getWordOfTheDay);
    const [pastHero, setPastHero] = useState(false);
    const [footerVisible, setFooterVisible] = useState(false);
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);
    const tabRef = useRef(null);

    useEffect(() => {
        const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.6);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        const el = footerRef?.current;
        if (!el || typeof IntersectionObserver === "undefined") return undefined;
        const observer = new IntersectionObserver(
            (entries) => setFooterVisible(entries.some((e) => e.isIntersecting)),
            { threshold: 0.05 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [footerRef]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") {
                setOpen(false);
                tabRef.current?.focus();
            }
        };
        const onOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onOutside);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onOutside);
        };
    }, [open]);

    if (!term) return null;
    const hidden = !pastHero || footerVisible;

    return (
        <div
            className={`lp-radio${hidden ? " lp-radio--hidden" : ""}${open ? " lp-radio--open" : ""}`}
            style={favs?.teamColor ? { "--radio-accent": favs.teamColor } : undefined}
        >
            {!open && (
                <button
                    ref={tabRef}
                    type="button"
                    className="lp-radio-tab"
                    onClick={() => setOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={false}
                    tabIndex={hidden ? -1 : 0}
                >
                    <span className="lp-radio-head">TERM OF THE DAY</span>
                    <span className="lp-radio-cta">
                        {term.title} <span aria-hidden="true">→</span>
                    </span>
                </button>
            )}

            {open && (
                <div ref={panelRef} className="lp-radio-panel" role="dialog" aria-label="Term of the day">
                    <div className="lp-radio-panel-head">
                        <span className="lp-radio-head">TERM OF THE DAY</span>
                        <button
                            type="button"
                            className="lp-radio-close"
                            onClick={() => setOpen(false)}
                            aria-label="Close"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    <h3 className="lp-radio-term">{term.title}</h3>
                    <p className="lp-radio-def">{term.meaning}</p>
                    {term.example && (
                        <p className="lp-radio-example">
                            <span>ON TRACK — </span>
                            {term.example}
                        </p>
                    )}

                    <Link
                        to={`/dictionary/${term.slug}`}
                        className="lp-cta lp-radio-link"
                        onClick={() => setOpen(false)}
                    >
                        EXPLORE F1 DICTIONARY <span aria-hidden="true">→</span>
                    </Link>
                </div>
            )}
        </div>
    );
}
