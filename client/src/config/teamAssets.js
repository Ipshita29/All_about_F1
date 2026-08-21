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
    red_bull: { car: "https://commons.wikimedia.org/wiki/Special:FilePath/Red_Bull_Racing_RB22_of_Max_Verstappen_(028A8078).jpg" },
    ferrari: { car: "https://commons.wikimedia.org/wiki/Special:FilePath/Ferrari_SF-26_of_Charles_Leclerc_(028A8059).jpg" },
    mercedes: { car: "https://commons.wikimedia.org/wiki/Special:FilePath/2026_Chinese_GP_-_Mercedes_-_W17.jpg" },
    mclaren: { car: "https://commons.wikimedia.org/wiki/Special:FilePath/Mclaren_MCL40_-_Lando_Norris_approaches_Spoon_Curve_at_Suzuka_during_the_2026_Japanese_GP_(55195326398).jpg" },
    aston_martin: { car: "https://commons.wikimedia.org/wiki/Special:FilePath/2026_Chinese_GP_-_Aston_Martin_-_AMR26.jpg" },
    alpine: { car: "https://commons.wikimedia.org/wiki/Special:FilePath/FIA_F1_Austria_2026_Alpine.jpg" },
    williams: { car: "https://commons.wikimedia.org/wiki/Special:FilePath/2026_Chinese_GP_-_Williams_-_Alex_Albon_-_Qualifying.jpg" },
    haas: { car: "https://commons.wikimedia.org/wiki/Special:FilePath/Haas_VF-26_of_Esteban_Ocon_(028A8050).jpg" },
    sauber: { car: "https://commons.wikimedia.org/wiki/Special:FilePath/2025_Japan_GP_-_Sauber_-_Nico_Hulkenberg_-_FP1.jpg" },
    rb: { car: "https://commons.wikimedia.org/wiki/Special:FilePath/2026_Chinese_GP_-_Racing_Bulls_-_Liam_Lawson_-_FP1.jpg" },
    audi: { car: "https://commons.wikimedia.org/wiki/Special:FilePath/Audi_R26_of_Nico_H%C3%BClkenberg_(028A8505).jpg" },
    cadillac: { car: "https://commons.wikimedia.org/wiki/Special:FilePath/Cadillac_at_the_2026_Australian_Grand_Prix_(028A7894).jpg" },
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
