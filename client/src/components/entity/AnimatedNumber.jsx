import { useEffect, useRef, useState } from "react";
import useReducedMotion from "../../hooks/useReducedMotion";

/*
 * Counts from 0 to `value` with an ease-out curve once `play` becomes true.
 * Non-numeric values (e.g. "—") render as-is. Decimals in the target are
 * preserved ("54.5" counts in halves' precision).
 */
function AnimatedNumber({ value, play = true, duration = 1100 }) {
    const reduced = useReducedMotion();
    const target = parseFloat(value);
    const numeric = !Number.isNaN(target);
    const decimals = numeric && String(value).includes(".")
        ? String(value).split(".")[1].length
        : 0;

    const [display, setDisplay] = useState(numeric ? 0 : value);
    const frame = useRef(0);

    useEffect(() => {
        if (!numeric) return undefined;

        const start = performance.now();
        const tick = (now) => {
            if (!play) { setDisplay(0); return; }
            if (reduced) { setDisplay(target); return; }
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setDisplay(target * eased);
            if (t < 1) frame.current = requestAnimationFrame(tick);
        };
        frame.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame.current);
    }, [numeric, play, reduced, target, duration]);

    if (!numeric) return <>{value ?? "—"}</>;
    return <>{display.toFixed(decimals)}</>;
}

export default AnimatedNumber;
