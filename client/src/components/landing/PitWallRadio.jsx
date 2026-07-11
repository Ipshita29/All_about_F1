/*
 * PIT WALL RADIO — floating, text-only daily briefing that replaces the old
 * Word of the Day popup on the landing page. No audio, no play buttons: it
 * is written as a pit-wall radio message.
 *
 * - Appears only after the visitor scrolls past the hero.
 * - Hides again while the garage footer is on screen (so it never covers it).
 * - The term comes from the existing dictionary data via getWordOfTheDay(),
 *   which already rotates deterministically once per day.
 * - Expanded panel closes on Escape, outside click, or the × button.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { getWordOfTheDay } from "../../utils/dictionaryHelpers";

export default function PitWallRadio({ user, favs, footerRef }) {
    const [term] = useState(getWordOfTheDay);
    const [pastHero, setPastHero] = useState(false);
    const [footerVisible, setFooterVisible] = useState(false);
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);
    const tabRef = useRef(null);

    const firstName = user?.name ? user.name.trim().split(" ")[0].toUpperCase() : null;

    /* Show only after the hero has been scrolled past */
    useEffect(() => {
        const onScroll = () => {
            setPastHero(window.scrollY > window.innerHeight * 0.8);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    /* Stand down while the footer is on screen */
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

    /* Escape + outside click close the expanded panel */
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
                    <span className="lp-radio-head lp-mono">
                        <i className="lp-radio-blink" aria-hidden="true" />
                        PIT WALL RADIO
                    </span>
                    <span className="lp-radio-callsign lp-mono">{firstName || "DRIVER"}</span>
                    <span className="lp-radio-quote">
                        {firstName
                            ? "“Box, box. Your daily briefing is ready.”"
                            : "“Your daily briefing is ready.”"}
                    </span>
                    <span className="lp-radio-cta lp-mono">
                        {term.title.toUpperCase()} <span aria-hidden="true">→</span>
                    </span>
                </button>
            )}

            {open && (
                <div
                    ref={panelRef}
                    className="lp-radio-panel"
                    role="dialog"
                    aria-label="Pit wall radio daily briefing"
                >
                    <div className="lp-radio-panel-head">
                        <span className="lp-radio-head lp-mono">
                            <i className="lp-radio-blink" aria-hidden="true" />
                            RADIO · CONNECTED
                        </span>
                        <button
                            type="button"
                            className="lp-radio-close"
                            onClick={() => setOpen(false)}
                            aria-label="Close briefing"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    <div className="lp-radio-wave" aria-hidden="true">
                        {Array.from({ length: 14 }).map((_, i) => (
                            <span key={i} style={{ "--i": i }} />
                        ))}
                    </div>

                    <p className="lp-radio-to lp-mono">TO: {firstName || "DRIVER"}</p>
                    <p className="lp-radio-message">
                        “{firstName ? "Box, box. " : ""}Today's race term is{" "}
                        <b>{term.title.toUpperCase()}</b>.”
                    </p>

                    <h3 className="lp-radio-term">{term.title}</h3>
                    <p className="lp-radio-def">{term.meaning}</p>
                    {term.example && (
                        <p className="lp-radio-example">
                            <span className="lp-mono">ON TRACK — </span>
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
