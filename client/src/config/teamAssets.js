/*
 * Centralized team asset configuration — PIT LANE / team experience.
 *
 * Swapping in better imagery later never requires touching component code:
 *
 *   1. Drop a transparent car side-view at /public/teams/cars/<constructorId>.png
 *      (or .webp) and it is picked up automatically — the canonical path is
 *      tried first, then the configured fallback (today: the press photos
 *      referenced from data/teamInfo.js), then a styled blueprint placeholder.
 *   2. Logos already live in /public/logos and are wired through teamInfo.
 *   3. Tune per-team framing with `objectPosition` / `scale` here.
 *
 * Keys are Ergast/Jolpica constructorIds (same ids the backend returns).
 */

import teamInfo from "../data/teamInfo";
import { TEAM_ACCENTS, DEFAULT_ACCENT } from "./driverAssets";

/* folder conventions — see ASSETS_REQUIRED.md */
export const TEAM_CAR_DIR = "/teams/cars";

/*
 * Per-team overrides. `car` should be a transparent side view when one is
 * available locally; while none exist the remote press photo from teamInfo
 * is used (rendered inside a darkened garage frame, so a rectangular photo
 * still reads well).
 */
const TEAM_ASSETS = {
    /* e.g.  ferrari: { car: "/teams/cars/ferrari.png", objectPosition: "center", scale: 1 }, */
};

/*
 * Resolve everything the UI needs to draw one constructor.
 * Returns car-image candidates ordered best-first; the <LayeredImage>
 * component walks the list until one loads.
 */
export function getTeamAssets(constructorId) {
    const conf = TEAM_ASSETS[constructorId] || {};
    const info = teamInfo[constructorId] || null;

    const carCandidates = [
        `${TEAM_CAR_DIR}/${constructorId}.webp`,
        `${TEAM_CAR_DIR}/${constructorId}.png`,
        conf.car,
        info?.image,
    ].filter(Boolean);

    return {
        carCandidates,
        logo: conf.logo || info?.logo || null,
        accent: TEAM_ACCENTS[constructorId] || DEFAULT_ACCENT,
        objectPosition: conf.objectPosition || "center",
        scale: conf.scale || 1,
        info,
    };
}

export default TEAM_ASSETS;
