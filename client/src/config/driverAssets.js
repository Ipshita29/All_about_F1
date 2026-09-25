/*
 * Centralized driver asset configuration — THE GRID / driver experience.
 *
 * Every visual decision about a driver lives here so that swapping in
 * better imagery later never requires touching component code:
 *
 *   1. Drop a transparent cutout at  /public/drivers/cutouts/<driverId>.png
 *      (or .webp) and it is picked up automatically — the canonical path is
 *      always tried first, then the configured fallback below, then the
 *      styled monogram placeholder.
 *   2. Drop a helmet render at       /public/drivers/helmets/<driverId>.png
 *   3. Tune per-driver framing with `objectPosition` / `scale` here.
 *
 * Keys are Ergast/Jolpica driverIds (the same ids used by the backend
 * routes, e.g. /drivers/2026 → driverId: "max_verstappen").
 */

import driverInfo from "../data/driverInfo";

/* folder conventions — see ASSETS_REQUIRED.md */
export const DRIVER_CUTOUT_DIR = "/drivers/cutouts";
export const DRIVER_HELMET_DIR = "/drivers/helmets";

/*
 * Restrained team accent colours for ambient lighting. These are
 * deliberately desaturated interpretations of the real liveries so they sit
 * inside the site palette (#141616 / #3D3C38 / #746D67 / #A49F9D / #7F1D1A)
 * instead of fighting it. Used at low opacity for glows and hairlines only.
 */
export const TEAM_ACCENTS = {
    red_bull: "#41639C",
    ferrari: "#9B2B22",
    mercedes: "#8FA3A0",
    mclaren: "#C07430",
    aston_martin: "#2F6B5B",
    alpine: "#3E6E9E",
    williams: "#3E5F8A",
    haas: "#8C8F93",
    sauber: "#3E8A57",
    audi: "#8F3B36",
    rb: "#4A5D9E",
    alphatauri: "#4A5D9E",
    cadillac: "#3D4C63",
    renault: "#B39B36",
    racing_point: "#A87E8E",
    alfa: "#7C2B2B",
};

export const DEFAULT_ACCENT = "#7F1D1A";

/*
 * The live timing feed (server/services/f1LiveTimingService.js) identifies
 * drivers by FIA three-letter code, not by the Ergast/Jolpica driverId used
 * everywhere else. This bridges the two so live-dashboard avatars can reuse
 * the same local cutouts as the rest of the site instead of a fresh image
 * source — bounded to the current grid, degrades to no image (never a
 * remote photo) for anyone missing from either side.
 */
export const DRIVER_CODE_TO_ID = {
    VER: "max_verstappen",
    LEC: "leclerc",
    HAM: "hamilton",
    RUS: "russell",
    ANT: "antonelli",
    NOR: "norris",
    PIA: "piastri",
    SAI: "sainz",
    HAD: "hadjar",
    ALB: "albon",
    ALO: "alonso",
    STR: "stroll",
    GAS: "gasly",
    OCO: "ocon",
    BEA: "bearman",
    TSU: "tsunoda",
    VET: "vettel",
    PER: "perez",
    LIN: "arvid_lindblad",
    COL: "colapinto",
    BOR: "bortoleto",
    LAW: "lawson",
    HUL: "hulkenberg",
    BOT: "bottas",
};

/*
 * Per-driver overrides. `image` points at a local transparent cutout in
 * /public/drivers — every driver here gets the same consistent treatment;
 * anyone missing from this map falls back to the styled monogram, never a
 * random remote photo. `objectPosition` and `scale` tune how the cutout
 * sits inside a Driver Pass / hero composition.
 */
const DRIVER_ASSETS = {
    max_verstappen: { image: "/drivers/max.png" },
    leclerc: { image: "/drivers/charles.png" },
    hamilton: { image: "/drivers/lewis.png" },
    russell: { image: "/drivers/george.png" },
    antonelli: { image: "/drivers/kimi.png" },
    norris: { image: "/drivers/lando.png" },
    piastri: { image: "/drivers/oscar.png" },
    sainz: { image: "/drivers/carlos.png" },
    hadjar: { image: "/drivers/isaac.png" },
    albon: { image: "/drivers/alex.png" },
    alonso: { image: "/drivers/fernando.png" },
    stroll: { image: "/drivers/lance.png" },
    gasly: { image: "/drivers/pierre.png" },
    ocon: { image: "/drivers/esteban.png" },
    bearman: { image: "/drivers/oliver.png" },
    tsunoda: { image: "/drivers/yuki.png" },
    vettel: { image: "/drivers/sebastian.png" },
    perez: { image: "/drivers/sergio.png" },
    arvid_lindblad: { image: "/drivers/arvid.png" },
    colapinto: { image: "/drivers/franco.png" },
    bortoleto: { image: "/drivers/gabriel.png" },
    lawson: { image: "/drivers/liam.png" },
    hulkenberg: { image: "/drivers/nico.png" },
    bottas: { image: "/drivers/valtteri.png" },
};

/*
 * Resolve everything the UI needs to draw one driver.
 * `fullName` is used to bridge into data/driverInfo.js (keyed by name).
 * Returns image candidates ordered best-first; the <LayeredImage> component
 * walks the list until one loads.
 *
 * Deliberately NOT included: driverInfo[name]?.image. That field mixes a
 * handful of local paths (duplicates of `conf.image` below) with remote
 * press photos of wildly different crops, angles and quality — exactly
 * the "some drivers get a huge photo, some get a tiny inconsistent one"
 * problem. Every driver either gets one of the real transparent cutouts
 * below, or the styled monogram fallback — never a random remote photo.
 */
export function getDriverAssets(driverId, fullName) {
    const conf = DRIVER_ASSETS[driverId] || {};
    const info = driverInfo[fullName] || null;

    const imageCandidates = [
        `${DRIVER_CUTOUT_DIR}/${driverId}.webp`,
        `${DRIVER_CUTOUT_DIR}/${driverId}.png`,
        conf.image,
    ].filter(Boolean);

    const helmetCandidates = [
        `${DRIVER_HELMET_DIR}/${driverId}.webp`,
        `${DRIVER_HELMET_DIR}/${driverId}.png`,
    ];

    return {
        imageCandidates,
        helmetCandidates,
        objectPosition: conf.objectPosition || "center top",
        scale: conf.scale || 1,
        info,
    };
}

export function getTeamAccent(constructorId) {
    return TEAM_ACCENTS[constructorId] || DEFAULT_ACCENT;
}

export default DRIVER_ASSETS;
