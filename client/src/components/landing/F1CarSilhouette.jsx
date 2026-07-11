/*
 * Local, dependency-free side view of an F1 car (nose pointing right).
 * Used by the intro animation and the garage footer so the "same car"
 * opens and closes the page.
 *
 * If you add a real transparent render at client/public/images/car-side.png
 * (see ASSETS_REQUIRED.md), set CAR_IMAGE_SRC to "/images/car-side.png" and
 * every usage upgrades automatically. Keeping it null avoids a 404 request
 * while the asset does not exist.
 */
import { useState } from "react";

export const CAR_IMAGE_SRC = null;

export function F1CarSilhouette({ className = "" }) {
    return (
        <svg
            viewBox="0 0 560 150"
            className={className}
            aria-hidden="true"
            focusable="false"
        >
            {/* rear light */}
            <rect className="lp-car-rearlight" x="10" y="52" width="7" height="18" rx="2" />
            {/* rear wing */}
            <path className="lp-car-body" d="M18 30 L86 34 L86 44 L18 42 Z" />
            <path className="lp-car-body" d="M22 44 L82 48 L82 56 L22 52 Z" />
            <rect className="lp-car-body" x="46" y="52" width="8" height="34" rx="3" />
            {/* engine cover + sidepod silhouette */}
            <path
                className="lp-car-body"
                d="M30 88
                   C 52 88 62 84 78 74
                   C 96 62 118 56 150 54
                   L 208 50
                   C 220 36 236 30 256 30
                   L 288 30
                   C 302 30 312 36 322 44
                   L 396 52
                   L 480 62
                   C 506 65 522 68 534 72
                   L 548 76
                   C 554 78 554 84 548 85
                   L 500 92
                   L 420 96
                   L 120 100
                   L 46 96
                   C 34 95 28 92 30 88 Z"
            />
            {/* halo */}
            <path
                className="lp-car-halo"
                d="M236 34 Q 262 8 292 32"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
            />
            {/* helmet hint inside cockpit */}
            <circle className="lp-car-helmet" cx="264" cy="34" r="11" />
            {/* nose + front wing */}
            <path className="lp-car-body" d="M470 78 L544 78 L556 84 L556 90 L470 90 Z" />
            <rect className="lp-car-body" x="536" y="66" width="5" height="26" rx="2" />
            {/* accent stripe along the sidepod */}
            <path
                className="lp-car-accent"
                d="M150 62 L392 66 L468 74 L466 80 L150 72 Z"
            />
            {/* floor shadow line */}
            <rect className="lp-car-floor" x="110" y="98" width="330" height="5" rx="2.5" />
            {/* rear wheel */}
            <g className="lp-car-wheel" style={{ transformOrigin: "128px 102px" }}>
                <circle className="lp-car-tyre" cx="128" cy="102" r="30" />
                <circle className="lp-car-rim" cx="128" cy="102" r="12" />
                <rect className="lp-car-spoke" x="126" y="86" width="4" height="32" rx="2" />
                <rect className="lp-car-spoke" x="112" y="100" width="32" height="4" rx="2" />
            </g>
            {/* front wheel */}
            <g className="lp-car-wheel" style={{ transformOrigin: "438px 104px" }}>
                <circle className="lp-car-tyre" cx="438" cy="104" r="28" />
                <circle className="lp-car-rim" cx="438" cy="104" r="11" />
                <rect className="lp-car-spoke" x="436" y="89" width="4" height="30" rx="2" />
                <rect className="lp-car-spoke" x="423" y="102" width="30" height="4" rx="2" />
            </g>
        </svg>
    );
}

/* Renders the PNG render when configured, otherwise the SVG silhouette. */
export default function CarVisual({ className = "" }) {
    const [imgFailed, setImgFailed] = useState(false);
    const useImage = CAR_IMAGE_SRC && !imgFailed;

    return (
        <div className={`lp-car-visual ${className}`}>
            {useImage ? (
                <img
                    src={CAR_IMAGE_SRC}
                    alt=""
                    aria-hidden="true"
                    className="lp-car-visual-img"
                    onError={() => setImgFailed(true)}
                />
            ) : (
                <F1CarSilhouette className="lp-car-visual-svg" />
            )}
        </div>
    );
}
