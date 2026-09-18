/*
 * Circuit as a technical drawing, not a photo. Walks the same local/remote
 * map candidates every other page uses; when none resolve, draws a
 * lightweight blueprint path instead — and that path carries a small marker
 * that eases around it once, showing the direction of travel. No image
 * asset is required for this to work.
 */
import { useState } from "react";
import { circuitMapCandidates } from "../../utils/landingHelpers";

const BLUEPRINT_PATH =
    "M40 140 L60 60 Q64 44 80 44 L150 50 Q170 52 180 38 Q188 26 204 30 " +
    "L250 44 Q266 49 260 66 L236 120 Q230 136 214 136 L70 152 Q48 154 40 140 Z";

function Blueprint() {
    return (
        <svg viewBox="0 0 300 180" className="cv-blueprint-svg" aria-hidden="true">
            <path
                d={BLUEPRINT_PATH}
                fill="none"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="5 7"
            />
            <circle className="cv-marker" r="3.5" />
        </svg>
    );
}

function CircuitImage({ circuitId }) {
    const [tier, setTier] = useState(0);
    const candidates = circuitMapCandidates(circuitId);
    const src = candidates[tier];
    if (!src) return <Blueprint />;
    return (
        <img
            src={src}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="cv-img"
            onError={() => setTier((t) => t + 1)}
        />
    );
}

export default function CircuitVisualization({ circuitId, circuitName, info }) {
    const lengthKm = info?.length ? info.length.split("(")[0].trim() : null;

    return (
        <div className="cv">
            <div className="cv-drawing">
                <CircuitImage circuitId={circuitId} />
            </div>
            <div className="cv-meta">
                <span className="cv-meta-label">{circuitName?.toUpperCase() || "CIRCUIT"}</span>
                <div className="cv-stats">
                    {lengthKm && (
                        <span><b>{lengthKm}</b><small>LENGTH</small></span>
                    )}
                    {info?.turns && (
                        <span><b>{info.turns}</b><small>TURNS</small></span>
                    )}
                    {info?.laps && (
                        <span><b>{info.laps}</b><small>LAPS</small></span>
                    )}
                </div>
            </div>
        </div>
    );
}
