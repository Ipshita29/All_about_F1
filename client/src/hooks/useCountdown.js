import { useEffect, useState } from "react";

function diffParts(target) {
    const diff = Math.max(0, target - Date.now());
    return {
        total: diff,
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
    };
}

/* Ticks once per second toward a Date (or ms timestamp); the interval is
   cleared on unmount and when the target changes. */
export default function useCountdown(target) {
    const time = target instanceof Date ? target.getTime() : target;
    const [parts, setParts] = useState(() => diffParts(time || 0));
    const [lastTime, setLastTime] = useState(time);

    /* re-sync immediately when the target changes (during render, per React
       docs, instead of a cascading setState inside the effect) */
    if (lastTime !== time) {
        setLastTime(time);
        setParts(diffParts(time || 0));
    }

    useEffect(() => {
        if (!time) return undefined;
        const id = setInterval(() => setParts(diffParts(time)), 1000);
        return () => clearInterval(id);
    }, [time]);

    return parts;
}
