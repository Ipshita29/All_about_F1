import teamInfo from "../data/teamInfo";
import driverInfo from "../data/driverInfo";

/* ── Favourite team name (Preferences values) → Jolpica constructorId ── */
export const FAV_TEAM_TO_CONSTRUCTOR_ID = {
    "Ferrari": "ferrari",
    "Mercedes": "mercedes",
    "Red Bull": "red_bull",
    "McLaren": "mclaren",
    "Aston Martin": "aston_martin",
    "Alpine": "alpine",
    "Haas": "haas",
    "Racing Bulls": "rb",
    "Williams": "williams",
    "Sauber": "sauber",
    "Cadillac": "cadillac",
};

/* Colours for teams that are missing from teamInfo (approximate brand colour) */
const EXTRA_TEAM_COLORS = {
    cadillac: "#9B7B4F",
};

/* Jolpica constructorIds that map onto a different teamInfo key */
const CONSTRUCTOR_ID_ALIASES = {
    audi: "audi",
    rb: "rb",
};

export function getTeamColor(constructorId) {
    if (!constructorId) return null;
    const key = CONSTRUCTOR_ID_ALIASES[constructorId] || constructorId;
    return (
        teamInfo[key]?.teamColors?.primary ||
        EXTRA_TEAM_COLORS[constructorId] ||
        null
    );
}

export function getTeamLogo(constructorId) {
    return teamInfo[constructorId]?.logo || null;
}

/* ── Driver full name (Jolpica) → detail-page driverId ── */
export const DRIVER_ID_MAP = {
    "Charles Leclerc": "leclerc",
    "Lewis Hamilton": "hamilton",
    "George Russell": "russell",
    "Kimi Antonelli": "antonelli",
    "Andrea Kimi Antonelli": "antonelli",
    "Max Verstappen": "max_verstappen",
    "Yuki Tsunoda": "tsunoda",
    "Lando Norris": "norris",
    "Oscar Piastri": "piastri",
    "Fernando Alonso": "alonso",
    "Lance Stroll": "stroll",
    "Pierre Gasly": "gasly",
    "Franco Colapinto": "colapinto",
    "Esteban Ocon": "ocon",
    "Oliver Bearman": "bearman",
    "Liam Lawson": "lawson",
    "Isack Hadjar": "hadjar",
    "Carlos Sainz": "sainz",
    "Alexander Albon": "albon",
    "Nico Hulkenberg": "hulkenberg",
    "Gabriel Bortoleto": "bortoleto",
};

/* Local portrait if the project ships one; remote driverInfo images are ignored
   so the landing page never depends on an external URL. */
export function getLocalDriverPortrait(fullName) {
    const short = fullName.replace("Andrea Kimi", "Kimi");
    const img = driverInfo[short]?.image || driverInfo[fullName]?.image;
    if (img && img.startsWith("/")) return img;
    return null;
}

/* Helmet/race-suit alternate portrait convention: /drivers/helmets/<same-file> */
export function getHelmetPortrait(fullName) {
    const portrait = getLocalDriverPortrait(fullName);
    if (!portrait) return null;
    const file = portrait.split("/").pop();
    return `/drivers/helmets/${file}`;
}

export function driverInitials(givenName = "", familyName = "") {
    return `${givenName.charAt(0)}${familyName.charAt(0)}`.toUpperCase();
}

/* Jolpica three-letter style code for timing rows */
export function driverCode(driver) {
    return driver?.code || (driver?.familyName || "").slice(0, 3).toUpperCase();
}

/* ── Favourites ── */
export function buildFavourites(user) {
    if (!user?.favoriteDriver && !user?.favoriteTeam) return null;
    const teamId = FAV_TEAM_TO_CONSTRUCTOR_ID[user.favoriteTeam] || null;
    return {
        driverName: user.favoriteDriver || null,
        driverFamily: user.favoriteDriver
            ? user.favoriteDriver.trim().split(" ").pop()
            : null,
        teamName: user.favoriteTeam || null,
        teamId,
        teamColor: getTeamColor(teamId),
    };
}

export function isFavouriteDriver(favs, driver) {
    if (!favs?.driverFamily || !driver) return false;
    return driver.familyName === favs.driverFamily;
}

export function isFavouriteTeam(favs, constructor) {
    if (!favs?.teamId || !constructor) return false;
    return constructor.constructorId === favs.teamId;
}

/* ── Sessions ── */
const SESSION_DEFS = [
    { key: "FirstPractice", label: "Practice 1", minutes: 60 },
    { key: "SecondPractice", label: "Practice 2", minutes: 60 },
    { key: "ThirdPractice", label: "Practice 3", minutes: 60 },
    { key: "SprintQualifying", label: "Sprint Qualifying", minutes: 45 },
    { key: "Sprint", label: "Sprint", minutes: 60 },
    { key: "Qualifying", label: "Qualifying", minutes: 60 },
];
const RACE_WINDOW_MINUTES = 180;

/* Every dated session of one race weekend, in chronological order */
export function getWeekendSessions(race) {
    if (!race) return [];
    const sessions = [];
    for (const { key, label, minutes } of SESSION_DEFS) {
        const s = race[key];
        if (!s?.date) continue;
        const start = s.time ? new Date(`${s.date}T${s.time}`) : new Date(`${s.date}T00:00:00`);
        sessions.push({ key, label, date: s.date, time: s.time || null, start, minutes });
    }
    if (race.date) {
        const start = race.time
            ? new Date(`${race.date}T${race.time}`)
            : new Date(`${race.date}T00:00:00`);
        sessions.push({
            key: "Race", label: "Race", date: race.date,
            time: race.time || null, start, minutes: RACE_WINDOW_MINUTES,
        });
    }
    return sessions.sort((a, b) => a.start - b.start);
}

/* Next session across the season schedule */
export function findNextSession(races) {
    const now = new Date();
    for (const race of races || []) {
        const upcoming = getWeekendSessions(race).filter((s) => s.start > now);
        if (upcoming.length > 0) return { ...upcoming[0], race };
    }
    return null;
}

/* A session whose scheduled window contains "now". Schedule-derived only —
   this is not a live-timing feed. */
export function findLiveSession(races) {
    const now = new Date();
    for (const race of races || []) {
        for (const s of getWeekendSessions(race)) {
            const end = new Date(s.start.getTime() + s.minutes * 60 * 1000);
            if (now >= s.start && now <= end) return { ...s, race };
        }
    }
    return null;
}

/* Races of a season whose race date is already behind us (newest first) */
export function getCompletedRaces(races) {
    const now = new Date();
    return (races || [])
        .filter((race) => {
            if (!race.date) return false;
            const t = race.time ? new Date(`${race.date}T${race.time}`) : new Date(`${race.date}T00:00:00`);
            return t < now;
        })
        .sort((a, b) => Number(b.round) - Number(a.round));
}

/* "17–19 JUL" style weekend range from first session to race day */
export function formatWeekendRange(race) {
    const sessions = getWeekendSessions(race);
    if (sessions.length === 0) return "";
    const first = sessions[0].start;
    const last = sessions[sessions.length - 1].start;
    const opts = { day: "numeric", month: "short" };
    const from = first.toLocaleDateString("en-GB", opts);
    const to = last.toLocaleDateString("en-GB", opts);
    return from === to ? from.toUpperCase() : `${from} – ${to}`.toUpperCase();
}

export function circuitMapSrc(circuitId) {
    return circuitId ? `/circuits/${circuitId}/map.png` : null;
}

/* Gap to championship leader, rendered as timing-style text */
export function pointsToLeader(points, leaderPoints) {
    const gap = Number(leaderPoints) - Number(points);
    if (gap <= 0) return "CHAMPIONSHIP LEADER";
    return `${gap} PTS TO P1`;
}

/* Grid → finish delta from real Ergast data; grid 0 means pit-lane start */
export function positionsGained(result) {
    const grid = Number(result?.grid);
    const finish = Number(result?.position);
    if (!grid || !finish || Number.isNaN(grid) || Number.isNaN(finish)) return null;
    return grid - finish;
}

/* Does a news article mention the user's favourite driver or team? */
export function articleIsForYou(article, favs) {
    if (!favs) return false;
    const text = `${article.title || ""} ${article.description || ""}`.toLowerCase();
    if (favs.driverFamily && text.includes(favs.driverFamily.toLowerCase())) return true;
    if (favs.teamName && text.includes(favs.teamName.toLowerCase())) return true;
    return false;
}

export function formatArticleTime(publishedAt) {
    if (!publishedAt) return "";
    const d = new Date(publishedAt);
    const diffMs = Date.now() - d.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours < 1) return "JUST IN";
    if (hours < 24) return `${hours}H AGO`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase();
}
