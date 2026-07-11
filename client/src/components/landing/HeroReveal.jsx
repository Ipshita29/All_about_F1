/*
 * Typography-led hero. Three perfectly stacked layers:
 *   1. faint car silhouette (parallax, revealed near the cursor)
 *   2. readable off-white "ALL ABOUT F1" headline (always visible)
 *   3. a red-lit duplicate of the headline, clipped by a radial CSS mask
 *      that follows the cursor
 *
 * The pointer only writes CSS custom properties (--hx/--hy) inside one
 * requestAnimationFrame — no React re-renders while the cursor moves.
 * Touch devices get an automatic slow sweep (CSS @property animation) and
 * reduced motion gets a static partial reveal; both live in LandingPage.css.
 */
import { useEffect, useRef } from "react";
import { F1CarSilhouette } from "./F1CarSilhouette";
import useReducedMotion from "../../hooks/useReducedMotion";

function HeroWordmark({ ariaHidden = false, className = "" }) {
    const Tag = ariaHidden ? "div" : "h1";
    return (
        <Tag className={`lp-hero-word ${className}`} aria-hidden={ariaHidden || undefined}>
            <span className="lp-hero-word-top">ALL ABOUT</span>
            <span className="lp-hero-word-f1">F1</span>
        </Tag>
    );
}

export default function HeroReveal() {
    const sectionRef = useRef(null);
    const frameRef = useRef(0);
    const reduced = useReducedMotion();

    useEffect(() => {
        const el = sectionRef.current;
        if (!el || reduced) return undefined;

        const onMove = (e) => {
            if (e.pointerType && e.pointerType !== "mouse") return;
            const rect = el.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            cancelAnimationFrame(frameRef.current);
            frameRef.current = requestAnimationFrame(() => {
                el.style.setProperty("--hx", `${x.toFixed(2)}%`);
                el.style.setProperty("--hy", `${y.toFixed(2)}%`);
                el.style.setProperty("--hshift", `${((x - 50) / 50).toFixed(3)}`);
                el.classList.add("lp-hero--tracking");
            });
        };
        const onLeave = () => el.classList.remove("lp-hero--tracking");

        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerleave", onLeave);
        return () => {
            el.removeEventListener("pointermove", onMove);
            el.removeEventListener("pointerleave", onLeave);
            cancelAnimationFrame(frameRef.current);
        };
    }, [reduced]);

    return (
        <section className="lp-hero" ref={sectionRef} aria-label="All About F1">
            <div className="lp-hero-gridlines" aria-hidden="true" />

            <div className="lp-hero-center">
                <p className="lp-hero-kicker">
                    <span className="lp-hero-kicker-dot" aria-hidden="true" />
                    FORMULA 1 · {new Date().getFullYear()} SEASON
                </p>

                <div className="lp-hero-stack">
                    <div className="lp-hero-carlayer" aria-hidden="true">
                        <F1CarSilhouette className="lp-hero-carsvg" />
                    </div>
                    <HeroWordmark />
                    <HeroWordmark ariaHidden className="lp-hero-word--reveal" />
                </div>

                <p className="lp-hero-tagline">THE GRID. THE SPEED. THE STORIES.</p>
            </div>

            <div className="lp-hero-foot">
                <span className="lp-hero-foot-item">SECTOR 01 — WELCOME</span>
                <a href="#race-center" className="lp-hero-scrollcue">
                    LIVE RACE CENTER
                    <span className="lp-hero-scrollcue-arrow" aria-hidden="true">↓</span>
                </a>
                <span className="lp-hero-foot-item lp-hero-foot-item--right">EST. LAP 00:00.000</span>
            </div>
        </section>
    );
}
