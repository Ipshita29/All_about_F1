import { useState } from "react";

/*
 * Image that walks an ordered list of candidate sources until one loads.
 * This is what makes the asset pipeline drop-in: canonical local paths are
 * listed first (they may 404 today), then whatever exists in the repo, and
 * finally `fallback` (a styled placeholder node) if nothing loads.
 */
function LayeredImage({ candidates = [], alt = "", className = "", style, fallback = null, draggable = false }) {
    const [idx, setIdx] = useState(0);

    /* restart the walk when the entity (and so the candidate list) changes —
       state adjustment during render, per the React docs pattern */
    const key = candidates.join("|");
    const [prevKey, setPrevKey] = useState(key);
    if (prevKey !== key) {
        setPrevKey(key);
        setIdx(0);
    }

    if (!candidates.length || idx >= candidates.length) return fallback;

    return (
        <img
            src={candidates[idx]}
            alt={alt}
            className={className}
            style={style}
            draggable={draggable}
            onError={() => setIdx((i) => i + 1)}
        />
    );
}

export default LayeredImage;
