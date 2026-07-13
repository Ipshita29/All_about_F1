import { useEffect, useRef, useState } from "react";

/*
 * Centered coverflow carousel for THE GRID.
 *
 * One item is always focused in the centre; neighbours recede in size,
 * depth and opacity (pure CSS math driven by two custom properties:
 * `--off` per card and a fractional `--dragf` on the track while dragging,
 * so direct manipulation moves every card continuously).
 *
 * Supported input: mouse wheel / trackpad, pointer drag, touch swipe,
 * ArrowLeft/Right/Home/End, prev/next controls, and clicking a side card
 * to centre it. Clicking the centred card fires `onSelect`.
 */
const VISIBLE_RANGE = 4;
const WHEEL_THRESHOLD = 60;
const WHEEL_COOLDOWN_MS = 260;

function GridCarousel({ items, active, onChange, onSelect, renderItem, getKey, statusFor }) {
    const viewportRef = useRef(null);
    const trackRef = useRef(null);
    const [dragging, setDragging] = useState(false);

    const clamp = (i) => Math.max(0, Math.min(items.length - 1, i));
    const step = (delta) => onChange(clamp(active + delta));

    /* ── mouse wheel / trackpad (non-passive so the page doesn't scroll) ── */
    const wheelAcc = useRef(0);
    const wheelLockUntil = useRef(0);
    const wheelState = useRef({ active, count: items.length });
    useEffect(() => {
        wheelState.current = { active, count: items.length };
    });

    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return undefined;
        const onWheel = (e) => {
            e.preventDefault();
            const now = performance.now();
            if (now < wheelLockUntil.current) return;
            const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            wheelAcc.current += delta;
            if (Math.abs(wheelAcc.current) >= WHEEL_THRESHOLD) {
                const dir = wheelAcc.current > 0 ? 1 : -1;
                wheelAcc.current = 0;
                wheelLockUntil.current = now + WHEEL_COOLDOWN_MS;
                const { active: a, count } = wheelState.current;
                onChange(Math.max(0, Math.min(count - 1, a + dir)));
            }
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ── pointer drag / touch swipe ── */
    const drag = useRef(null);
    /* ref (not state) so the click that follows a drag release is reliably
       suppressed even after React flushes the pointerup state update */
    const justDragged = useRef(false);
    const gapPx = () => {
        const w = window.innerWidth;
        return Math.max(190, Math.min(300, w * 0.22));
    };

    const onPointerDown = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        drag.current = { startX: e.clientX, moved: false, pointerId: e.pointerId };
        /* capture is intentionally NOT taken here — grabbing it on every
           pointerdown redirects the click that follows a plain tap away
           from the card button (the browser resolves click against the
           capturing element), which silently broke selection. Capture is
           acquired only once real dragging starts, below. */
    };
    const onPointerMove = (e) => {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.startX;
        if (!drag.current.moved && Math.abs(dx) > 6) {
            drag.current.moved = true;
            setDragging(true);
            viewportRef.current?.setPointerCapture?.(drag.current.pointerId);
        }
        if (drag.current.moved && trackRef.current) {
            trackRef.current.style.setProperty("--dragf", String(-dx / gapPx()));
        }
    };
    const endDrag = (e) => {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.startX;
        const wasDrag = drag.current.moved;
        if (wasDrag) viewportRef.current?.releasePointerCapture?.(drag.current.pointerId);
        drag.current = null;
        if (trackRef.current) trackRef.current.style.setProperty("--dragf", "0");
        setDragging(false);
        if (wasDrag) {
            justDragged.current = true;
            setTimeout(() => { justDragged.current = false; }, 0);
            const steps = Math.round(-dx / gapPx());
            if (steps !== 0) step(steps);
            else if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
        }
    };

    const onKeyDown = (e) => {
        if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
        else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
        else if (e.key === "Home") { e.preventDefault(); onChange(0); }
        else if (e.key === "End") { e.preventDefault(); onChange(items.length - 1); }
        else if (e.key === "Enter" && items[active]) { onSelect(items[active], active); }
    };

    if (!items.length) return null;

    return (
        <div className="ex-carousel" role="region" aria-roledescription="carousel" aria-label="The Grid — driver line-up">
            <div
                className="ex-carousel-viewport"
                ref={viewportRef}
                tabIndex={0}
                onKeyDown={onKeyDown}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                <div className={`ex-carousel-track${dragging ? " is-dragging" : ""}`} ref={trackRef}>
                    {items.map((item, i) => {
                        const off = i - active;
                        const hidden = Math.abs(off) > VISIBLE_RANGE;
                        return (
                            <div
                                key={getKey(item)}
                                className={`ex-coach${off === 0 ? " is-front" : ""}${hidden ? " is-hidden" : ""}`}
                                style={{ "--off": off, zIndex: 100 - Math.abs(off) }}
                                aria-hidden={off !== 0}
                            >
                                <button
                                    type="button"
                                    className="ex-coach-hit"
                                    tabIndex={-1}
                                    aria-label={statusFor ? statusFor(item) : undefined}
                                    onClick={(e) => {
                                        /* a click that ended a drag is not a selection */
                                        if (dragging || justDragged.current) {
                                            e.preventDefault();
                                            return;
                                        }
                                        if (off === 0) onSelect(item, i);
                                        else onChange(i);
                                    }}
                                >
                                    {renderItem(item, i, off === 0)}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="ex-carousel-controls">
                <button
                    type="button"
                    className="ex-carousel-btn"
                    onClick={() => step(-1)}
                    disabled={active === 0}
                    aria-label="Previous driver"
                >
                    ←
                </button>
                <span className="ex-carousel-status" aria-live="polite">
                    <span className="ex-carousel-status-cur">{String(active + 1).padStart(2, "0")}</span>
                    <span className="ex-carousel-status-sep">/</span>
                    {String(items.length).padStart(2, "0")}
                </span>
                <button
                    type="button"
                    className="ex-carousel-btn"
                    onClick={() => step(1)}
                    disabled={active === items.length - 1}
                    aria-label="Next driver"
                >
                    →
                </button>
            </div>
        </div>
    );
}

export default GridCarousel;
