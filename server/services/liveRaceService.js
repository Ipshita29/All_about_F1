/*
 * Boundary between external F1 data providers and the rest of the app for
 * the Live Race Dashboard (Phase 11). Two providers feed this:
 *
 *   Jolpica/Ergast — schedule, results, standings (server/controllers/
 *   grandprixController.js etc. already use it directly for those). Here
 *   it's only used as the schedule fallback: it always knows the season
 *   calendar, but never has genuine live in-session data.
 *
 *   F1's own live timing feed (server/services/f1LiveTimingService.js) —
 *   the free, unauthenticated SignalR stream FastF1 also talks to. It's
 *   preferred whenever it's actually tracking a session; Jolpica's
 *   estimated windows are the fallback the rest of the time.
 *
 * This file never talks to either provider's network APIs directly except
 * the one Jolpica schedule call kept from Phase 10 — all live-timing access
 * goes through f1LiveTimingService so protocol-specific details stay out.
 */

const f1LiveTimingService = require("./f1LiveTimingService");

f1LiveTimingService.init();

const JOLPICA_BASE = "https://api.jolpi.ca/ergast/f1";
const JOLPICA_CACHE_TTL_MS = 60 * 1000;

// Ergast/Jolpica gives session start times but not durations, so these
// windows are estimated using each session type's standard FIA duration.
// Only used when the live timing feed hasn't given us a real session window.
const SESSION_DURATIONS_MS = {
    practice1: 60 * 60 * 1000,
    practice2: 60 * 60 * 1000,
    practice3: 60 * 60 * 1000,
    sprintQualifying: 45 * 60 * 1000,
    sprint: 45 * 60 * 1000,
    qualifying: 60 * 60 * 1000,
    race: 2 * 60 * 60 * 1000,
};

const JOLPICA_SESSION_FIELD_MAP = [
    ["FirstPractice", "practice1"],
    ["SecondPractice", "practice2"],
    ["ThirdPractice", "practice3"],
    ["SprintQualifying", "sprintQualifying"],
    ["Sprint", "sprint"],
    ["Qualifying", "qualifying"],
];

const SESSION_NAME_MAP = {
    "Practice 1": "practice1",
    "Practice 2": "practice2",
    "Practice 3": "practice3",
    "Sprint Qualifying": "sprintQualifying",
    "Sprint": "sprint",
    "Qualifying": "qualifying",
    "Race": "race",
};

let jolpicaCache = { data: null, expiresAt: 0 };

function toDate(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const d = new Date(`${dateStr}T${timeStr}`);
    return Number.isNaN(d.getTime()) ? null : d;
}

// SessionInfo.StartDate/EndDate are local track time with no offset suffix;
// GmtOffset ("04:00:00") is how far ahead of UTC that local time is.
function localToUtc(localDateStr, gmtOffsetStr) {
    if (!localDateStr) return null;
    const asIfUtc = new Date(`${localDateStr}Z`);
    if (Number.isNaN(asIfUtc.getTime())) return null;
    if (!gmtOffsetStr) return asIfUtc;
    const [h, m, s] = gmtOffsetStr.split(":").map(Number);
    const offsetMs = ((h || 0) * 3600 + (m || 0) * 60 + (s || 0)) * 1000;
    return new Date(asIfUtc.getTime() - offsetMs);
}

async function fetchNextRace() {
    const now = Date.now();
    if (jolpicaCache.data !== undefined && jolpicaCache.expiresAt > now) {
        return jolpicaCache.data;
    }
    const response = await fetch(`${JOLPICA_BASE}/current/next.json`);
    if (!response.ok) throw new Error(`Jolpica responded with ${response.status}`);
    const data = await response.json();
    const race = data.MRData.RaceTable.Races[0] || null;
    jolpicaCache = { data: race, expiresAt: now + JOLPICA_CACHE_TTL_MS };
    return race;
}

function buildJolpicaSessionWindows(race) {
    const sessions = [];
    for (const [field, type] of JOLPICA_SESSION_FIELD_MAP) {
        const info = race[field];
        const start = info ? toDate(info.date, info.time) : null;
        if (!start) continue;
        sessions.push({ type, start, end: new Date(start.getTime() + SESSION_DURATIONS_MS[type]) });
    }
    const raceStart = toDate(race.date, race.time);
    if (raceStart) {
        sessions.push({ type: "race", start: raceStart, end: new Date(raceStart.getTime() + SESSION_DURATIONS_MS.race) });
    }
    sessions.sort((a, b) => a.start - b.start);
    return sessions;
}

function resolveSessionState(sessions, now) {
    const live = sessions.find((s) => now >= s.start && now <= s.end);
    if (live) {
        return { isLive: true, sessionType: live.type, sessionStatus: "live", startTime: live.start.toISOString() };
    }
    const next = sessions.find((s) => s.start > now);
    if (next) {
        return { isLive: false, sessionType: next.type, sessionStatus: "upcoming", startTime: next.start.toISOString() };
    }
    return { isLive: false, sessionType: null, sessionStatus: "none", startTime: null };
}

// A single-session window built from the live feed's own SessionInfo, when
// it has one — more precise than Jolpica's estimate (real StartDate/EndDate
// instead of a guessed duration), but only ever describes one session at a
// time (whichever one the feed is currently tracking), not the full weekend.
function buildLiveSessionWindow(sessionInfo) {
    if (!sessionInfo?.StartDate) return null;
    const start = localToUtc(sessionInfo.StartDate, sessionInfo.GmtOffset);
    const end = localToUtc(sessionInfo.EndDate, sessionInfo.GmtOffset);
    if (!start || !end) return null;
    return {
        type: SESSION_NAME_MAP[sessionInfo.Name] ?? sessionInfo.Type?.toLowerCase() ?? "unknown",
        start,
        end,
    };
}

// ---------------------------------------------------------------------------
// Live timing normalization
// ---------------------------------------------------------------------------

function numOrNull(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
}

function strOrNull(v) {
    return v === null || v === undefined || v === "" ? null : v;
}

// Known CarData channel codes (0:RPM 2:Speed 3:nGear 4:Throttle 5:Brake
// 45:DRS) — documented for completeness; CarData.z was confirmed silent
// without an F1TV subscription token, so this only matters if F1 ever
// opens that channel up, or a token is added later.
const CAR_DATA_CHANNELS = { rpm: "0", speed: "2", gear: "3", throttle: "4", brake: "5", drs: "45" };

/*
 * Gap-to-leader / interval-to-car-ahead live at two DIFFERENT places in
 * TimingData.Lines[num] depending on session type — confirmed by directly
 * inspecting the raw feed during a live qualifying session:
 *
 *   RACE / SPRINT:  top-level `GapToLeader` (string) and
 *                    `IntervalToPositionAhead.Value`.
 *   QUALIFYING / PRACTICE: no top-level gap/interval at all — instead a
 *   `Stats` array, one entry per session segment (Q1/Q2/Q3, or the single
 *   practice segment), each with `TimeDiffToFastest` and
 *   `TimeDifftoPositionAhead` (yes, that capitalization — it's what the
 *   feed actually sends). Reading only the race-shaped fields is why gap/
 *   interval always showed "-" in qualifying even with a fully live
 *   connection; this checks both shapes rather than assuming one.
 */
function latestStatsEntry(stats) {
    if (!Array.isArray(stats) || stats.length === 0) return null;
    for (let i = stats.length - 1; i >= 0; i--) {
        const entry = stats[i];
        if (entry && (entry.TimeDiffToFastest || entry.TimeDifftoPositionAhead)) return entry;
    }
    return stats[stats.length - 1] || null;
}

function timingGapToLeader(timing) {
    const raceField = strOrNull(timing?.GapToLeader);
    if (raceField !== null) return raceField;
    return strOrNull(latestStatsEntry(timing?.Stats)?.TimeDiffToFastest);
}

function timingGapToAhead(timing) {
    const raceField = strOrNull(timing?.IntervalToPositionAhead?.Value);
    if (raceField !== null) return raceField;
    return strOrNull(latestStatsEntry(timing?.Stats)?.TimeDifftoPositionAhead);
}

function normalizeDrivers(state) {
    const numbers = new Set([
        ...Object.keys(state.driverList),
        ...Object.keys(state.timingData),
        ...Object.keys(state.timingAppData),
        ...Object.keys(state.timingStats),
    ]);

    return Array.from(numbers).map((num) => {
        const info = state.driverList[num];
        const timing = state.timingData[num];
        const appData = state.timingAppData[num];
        const stats = state.timingStats[num];
        const car = state.carData[num];
        const loc = state.location[num];

        // .filter(Boolean) guards against a sparse array — if an index-keyed
        // stint patch ever arrives for an index higher than what's been
        // seen so far (e.g. index 2 before index 1 has ever been set), the
        // array grows with a genuine hole in between. Without the filter,
        // stints[stints.length - 1] would still correctly pick the newest
        // stint by position, but stintNumber/pitStops (derived from
        // stints.length) would overcount by however many holes exist.
        const stints = Array.isArray(appData?.Stints) ? appData.Stints.filter(Boolean) : [];
        const currentStint = stints[stints.length - 1];

        const status = timing?.Retired ? "retired" : timing?.Stopped ? "stopped" : timing?.InPit ? "pit" : "racing";

        return {
            driverNumber: Number(num),
            driverCode: info?.Tla ?? null,
            name: info?.FullName ?? null,
            team: info?.TeamName ?? null,
            teamColor: info?.TeamColour ? `#${info.TeamColour}` : null,
            position: numOrNull(timing?.Position),
            gapToLeader: timingGapToLeader(timing),
            gapToAhead: timingGapToAhead(timing),
            lastLap: strOrNull(timing?.LastLapTime?.Value),
            bestLap: strOrNull(stats?.PersonalBestLapTime?.Value ?? timing?.BestLapTime?.Value),
            currentTyre: currentStint?.Compound ?? null,
            tyreAge: currentStint?.TotalLaps ?? null,
            stintNumber: stints.length || null,
            pitStops: Math.max(stints.length - 1, 0),
            sector1: strOrNull(timing?.Sectors?.[0]?.Value),
            sector2: strOrNull(timing?.Sectors?.[1]?.Value),
            sector3: strOrNull(timing?.Sectors?.[2]?.Value),
            speed: numOrNull(car?.[CAR_DATA_CHANNELS.speed]),
            throttle: numOrNull(car?.[CAR_DATA_CHANNELS.throttle]),
            brake: numOrNull(car?.[CAR_DATA_CHANNELS.brake]),
            gear: numOrNull(car?.[CAR_DATA_CHANNELS.gear]),
            rpm: numOrNull(car?.[CAR_DATA_CHANNELS.rpm]),
            drs: numOrNull(car?.[CAR_DATA_CHANNELS.drs]),
            location: loc ? { x: loc.X ?? null, y: loc.Y ?? null, z: loc.Z ?? null, timestamp: loc.timestamp ?? null } : null,
            status,
        };
    });
}

function normalizeEvents(raceControl) {
    return raceControl.map((rc, i) => ({
        id: `${rc.Utc ?? "unknown"}-${i}`,
        type: rc.Flag ?? rc.Category ?? null,
        category: rc.Category ?? null,
        message: rc.Message ?? null,
        driverNumber: rc.RacingNumber ? Number(rc.RacingNumber) : null,
        timestamp: rc.Utc ?? null,
    }));
}

function normalizeWeather(weather) {
    if (!weather) return null;
    return {
        airTemperature: numOrNull(weather.AirTemp),
        trackTemperature: numOrNull(weather.TrackTemp),
        humidity: numOrNull(weather.Humidity),
        windSpeed: numOrNull(weather.WindSpeed),
        windDirection: numOrNull(weather.WindDirection),
        rainfall: numOrNull(weather.Rainfall),
        timestamp: null, // WeatherData carries no per-sample timestamp field of its own
    };
}

function normalizeTeamRadio(captures, driverList) {
    return captures.map((c) => ({
        driverNumber: c.RacingNumber ? Number(c.RacingNumber) : null,
        team: driverList[c.RacingNumber]?.TeamName ?? null,
        timestamp: c.Utc ?? null,
        recordingUrl: f1LiveTimingService.teamRadioUrl(c),
    }));
}

function normalizeTrack(trackStatus, weather) {
    if (!trackStatus && !weather) return null;
    return {
        status: trackStatus?.Message ?? null,
        condition: weather ? (numOrNull(weather.Rainfall) > 0 ? "wet" : "dry") : null,
        temperature: numOrNull(weather?.TrackTemp),
        rainfall: numOrNull(weather?.Rainfall),
    };
}

// ---------------------------------------------------------------------------
// Public entry point — GET /api/live/race reads this
// ---------------------------------------------------------------------------

async function getLiveRaceStatus() {
    const now = new Date();
    const liveState = f1LiveTimingService.getState();
    const liveWindow = buildLiveSessionWindow(liveState.sessionInfo);
    const usingLiveFeedSchedule = liveWindow !== null;

    let jolpicaRace = null;
    try {
        jolpicaRace = await fetchNextRace();
    } catch (error) {
        // Schedule fetch failing doesn't need to fail the whole response —
        // the live feed may still be able to answer "is something live now".
    }

    let state = usingLiveFeedSchedule
        ? resolveSessionState([liveWindow], now)
        : jolpicaRace
            ? resolveSessionState(buildJolpicaSessionWindows(jolpicaRace), now)
            : { isLive: false, sessionType: null, sessionStatus: "none", startTime: null };

    // The live feed only ever exposes ONE session — whichever it's currently
    // tracking. Once that session ends and the feed hasn't advanced to the
    // next one yet, its window resolves to "nothing next" even though
    // Jolpica's full-weekend schedule knows exactly what's coming. Fall back
    // to that schedule (and its race identity) so "next session" doesn't go
    // dark for the gap between sessions.
    let identitySource = usingLiveFeedSchedule;
    if (usingLiveFeedSchedule && !state.isLive && state.sessionType === null && jolpicaRace) {
        state = resolveSessionState(buildJolpicaSessionWindows(jolpicaRace), now);
        identitySource = false;
    }

    if (!jolpicaRace && !usingLiveFeedSchedule) {
        return {
            isLive: false,
            sessionType: null,
            sessionStatus: "none",
            dataStatus: "unavailable",
            provider: null,
            race: null,
            track: null,
            drivers: [],
            events: [],
            weather: null,
            teamRadio: [],
            message: "No race is currently live.",
            updatedAt: now.toISOString(),
        };
    }

    const hasLiveTelemetry = state.isLive && usingLiveFeedSchedule && Object.keys(liveState.driverList).length > 0;

    const drivers = hasLiveTelemetry ? normalizeDrivers(liveState) : [];
    const events = hasLiveTelemetry ? normalizeEvents(liveState.raceControl) : [];
    const weather = hasLiveTelemetry ? normalizeWeather(liveState.weather) : null;
    const teamRadio = hasLiveTelemetry ? normalizeTeamRadio(liveState.teamRadio, liveState.driverList) : [];
    const track = hasLiveTelemetry ? normalizeTrack(liveState.trackStatus, liveState.weather) : null;

    const dataStatus = !state.isLive
        ? "unavailable"
        : hasLiveTelemetry && drivers.length > 0 && weather && track?.status
            ? "complete"
            : hasLiveTelemetry
                ? "partial"
                : "unavailable";

    const meeting = liveState.sessionInfo?.Meeting;
    const grandPrix = identitySource ? meeting?.Name ?? jolpicaRace?.raceName ?? null : jolpicaRace?.raceName ?? null;
    const circuit = identitySource ? meeting?.Circuit?.ShortName ?? jolpicaRace?.Circuit?.circuitName ?? null : jolpicaRace?.Circuit?.circuitName ?? null;
    const country = identitySource ? meeting?.Country?.Name ?? jolpicaRace?.Circuit?.Location?.country ?? null : jolpicaRace?.Circuit?.Location?.country ?? null;
    const round = identitySource ? String(meeting?.Number ?? jolpicaRace?.round ?? "") || null : jolpicaRace?.round ?? null;
    const season = identitySource
        ? liveState.sessionInfo?.StartDate?.slice(0, 4) ?? jolpicaRace?.season ?? null
        : jolpicaRace?.season ?? null;

    return {
        isLive: state.isLive,
        sessionType: state.sessionType,
        sessionStatus: state.sessionStatus,
        dataStatus,
        provider: hasLiveTelemetry ? "f1-live-timing" : null,
        race: jolpicaRace || usingLiveFeedSchedule
            ? {
                grandPrix,
                circuit,
                country,
                round,
                season,
                session: state.sessionType,
                sessionStatus: state.sessionStatus,
                startTime: state.startTime,
                currentLap: liveState.lapCount?.CurrentLap ?? null,
                totalLaps: liveState.lapCount?.TotalLaps ?? null,
            }
            : null,
        track,
        drivers,
        events,
        weather,
        teamRadio,
        message: state.isLive
            ? `${state.sessionType} session is live.`
            : state.startTime
                ? `No live session. Next session starts at ${state.startTime}.`
                : "No race is currently live.",
        updatedAt: now.toISOString(),
    };
}

module.exports = { getLiveRaceStatus };
