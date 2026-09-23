/*
 * Circuit as a technical drawing, not a photo — shared by the homepage
 * hero, the Circuits roster and Circuit Details.
 *
 * Walks the same local/remote map candidates every other page uses; when
 * none resolve, draws a lightweight blueprint path instead — and that path
 * carries a small marker that eases around it once, showing the direction
 * of travel. No image asset is required for this to work.
 *
 * The drawing always sits on its own white plate rather than being
 * grayscale-inverted to fit the dark theme — inverting arbitrary source
 * images produced inconsistent, muddy results across different circuits.
 * A real technical drawing reads on white paper; so does this one.
 */
import { useState } from "react";
import { circuitMapCandidates } from "../utils/landingHelpers";

const BLUEPRINT_PATH =
    "M40 140 L60 60 Q64 44 80 44 L150 50 Q170 52 180 38 Q188 26 204 30 " +
    "L250 44 Q266 49 260 66 L236 120 Q230 136 214 136 L70 152 Q48 154 40 140 Z";

function Blueprint() {
    return (
        <svg viewBox="0 0 300 180" className="cv-blueprint-svg" aria-hidden="true">
            <path
                d={BLUEPRINT_PATH}
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="6 8"
            />
            <circle className="cv-marker" r="4" />
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

export default function CircuitVisualization({ circuitId, circuitName, info, compact = false, showMeta = true }) {
    const lengthKm = info?.length ? info.length.split("(")[0].trim() : null;

    return (
        <div className={`cv${compact ? " cv--compact" : ""}`}>
            <div className="cv-drawing">
                <CircuitImage circuitId={circuitId} />
            </div>
            {showMeta && (
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
            )}
        </div>
    );
}
