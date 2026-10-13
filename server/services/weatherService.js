/*
 * Forecast for an upcoming session, from Open-Meteo — free, keyless,
 * hourly resolution. Circuit coordinates come from the caller (Jolpica's
 * schedule already includes Circuit.Location.lat/long for every race, so
 * nothing new needs to be fetched or hardcoded to get them).
 *
 * Open-Meteo only forecasts ~16 days out; a race further away than that
 * genuinely has no forecast yet, so this returns null rather than
 * inventing one — the controller turns that into an honest
 * "forecast unavailable" rather than a fabricated value.
 *
 * Since Phase 3.5, this file also exposes getHistoricalWeather(), a
 * SEPARATE function for PAST dates, from Open-Meteo's sibling Historical
 * Weather (archive/reanalysis) API — confirmed live against real past F1
 * race dates/coordinates back to at least 2021 (Open-Meteo's own archive
 * covers back to 1940). getForecast() itself is untouched below: same
 * function, same behavior, still the only thing the live /forecast route
 * calls.
 */

const { cached, TTL } = require("./jolpicaCache");

const FORECAST_DAYS = 16;
const STALE_THRESHOLD_MS = 18 * 60 * 60 * 1000; // closest hour must be within ~18h of the session

async function fetchHourly(lat, lon) {
    const key = `weather:${lat}:${lon}`;
    return cached(key, TTL.FORECAST, async () => {
        const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&hourly=temperature_2m,precipitation_probability,windspeed_10m,winddirection_10m,relative_humidity_2m,weathercode` +
            `&forecast_days=${FORECAST_DAYS}&timezone=UTC`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Open-Meteo request failed");
        return response.json();
    });
}

async function fetchPrimaryForecast(lat, lon, targetMs) {
    const data = await fetchHourly(lat, lon);
    const times = data?.hourly?.time;
    if (!Array.isArray(times) || times.length === 0) return null;

    let bestIndex = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < times.length; i++) {
        const diff = Math.abs(new Date(`${times[i]}Z`).getTime() - targetMs);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestIndex = i;
        }
    }

    if (bestIndex === -1 || bestDiff > STALE_THRESHOLD_MS) return null;

    const hourly = data.hourly;
    return {
        provider: "open-meteo",
        forecastFor: `${times[bestIndex]}Z`,
        airTemperature: hourly.temperature_2m?.[bestIndex] ?? null,
        precipitationProbability: hourly.precipitation_probability?.[bestIndex] ?? null,
        windSpeed: hourly.windspeed_10m?.[bestIndex] ?? null,
        windDirection: hourly.winddirection_10m?.[bestIndex] ?? null,
        humidity: hourly.relative_humidity_2m?.[bestIndex] ?? null,
        weatherCode: hourly.weathercode?.[bestIndex] ?? null,
    };
}

/*
 * ── Fallback provider: wttr.in ──────────────────────────────────────
 * Free, keyless, global. Only ever consulted when Open-Meteo's own
 * request throws or comes back with nothing usable — this is a safety
 * net, not a second source of truth, so the UI never sits on a blank
 * weather card just because one upstream had a bad moment. wttr.in's
 * own data only spans "today" plus ~2 days ahead, so it is only tried
 * when the requested moment actually falls in that window; outside it,
 * this correctly returns null rather than guessing.
 */
const WTTR_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

// wttr.in reports WorldWeatherOnline's own condition codes, not Open-
// Meteo's WMO codes the rest of this app (and the frontend's condition
// table) already uses — mapped onto the closest WMO equivalent so every
// caller can keep reading a single `weatherCode` field regardless of
// which provider actually answered.
const WWO_TO_WMO = {
    113: 0, 116: 1, 119: 2, 122: 3,
    143: 45, 248: 45, 260: 48,
    176: 80, 263: 51, 266: 51, 281: 56, 284: 57, 293: 51, 296: 61,
    299: 63, 302: 63, 305: 65, 308: 65, 311: 66, 314: 67,
    179: 71, 182: 67, 185: 56, 227: 77, 230: 86, 317: 71, 320: 73,
    323: 71, 326: 71, 329: 73, 332: 73, 335: 75, 338: 75, 350: 77,
    353: 80, 356: 81, 359: 82, 362: 85, 365: 86, 368: 71, 371: 73,
    374: 85, 377: 86,
    200: 95, 386: 95, 389: 97, 392: 96, 395: 99,
};

function fetchWttr(lat, lon) {
    const key = `weather-wttr:${lat}:${lon}`;
    return cached(key, TTL.FORECAST, async () => {
        const url = `https://wttr.in/${lat},${lon}?format=j1`;
        const response = await fetch(url, { headers: { "User-Agent": "curl" } });
        if (!response.ok) throw new Error("wttr.in request failed");
        return response.json();
    });
}

// wttr.in's own `hourly[].time` is minutes-past-midnight written without
// padding ("0", "300", … "2100", one entry per 3h) — paired with that
// day's `date` to build a real timestamp comparable to any other.
function wttrHourToDate(dateStr, timeField) {
    const minutes = Number(timeField);
    if (Number.isNaN(minutes)) return null;
    const hour = Math.floor(minutes / 100);
    return new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00Z`);
}

function wttrReadingFrom(hour, forecastFor) {
    return {
        provider: "wttr",
        forecastFor,
        airTemperature: hour.tempC != null ? Number(hour.tempC) : null,
        precipitationProbability: hour.chanceofrain != null ? Number(hour.chanceofrain) : null,
        precipitationAmount: hour.precipMM != null ? Number(hour.precipMM) : null,
        windSpeed: hour.windspeedKmph != null ? Number(hour.windspeedKmph) : null,
        windDirection: hour.winddirDegree != null ? Number(hour.winddirDegree) : null,
        humidity: hour.humidity != null ? Number(hour.humidity) : null,
        weatherCode: WWO_TO_WMO[Number(hour.weatherCode)] ?? 3,
    };
}

async function fetchFallbackReading(lat, lon, targetMs) {
    let data;
    try {
        data = await fetchWttr(lat, lon);
    } catch {
        return null;
    }

    const days = data?.weather;
    if (!Array.isArray(days) || days.length === 0) return null;

    let best = null;
    let bestDiff = Infinity;
    for (const day of days) {
        for (const hour of day.hourly || []) {
            const d = wttrHourToDate(day.date, hour.time);
            if (!d) continue;
            const diff = Math.abs(d.getTime() - targetMs);
            if (diff < bestDiff) {
                bestDiff = diff;
                best = { hour, forecastFor: d.toISOString() };
            }
        }
    }

    if (!best || bestDiff > WTTR_WINDOW_MS) return null;
    return wttrReadingFrom(best.hour, best.forecastFor);
}

async function getForecast(lat, lon, targetIso) {
    const targetMs = new Date(targetIso).getTime();
    if (Number.isNaN(targetMs)) return null;

    try {
        const primary = await fetchPrimaryForecast(lat, lon, targetMs);
        if (primary) return primary;
    } catch {
        // falls through to the fallback provider below
    }

    return fetchFallbackReading(lat, lon, targetMs);
}

/*
 * ─────────────────────────────────────────────────────────────────────
 * HISTORICAL (Phase 3.5) — Open-Meteo's archive endpoint, a different
 * host (archive-api.open-meteo.com) and dataset (ERA5 reanalysis) from
 * the forecast one above, but the same free/keyless access pattern and
 * the same {hourly: {time: [...], field: [...]}} response shape.
 *
 * Field parity is NOT identical to the forecast: `precipitation_probability`
 * is a forecast-only concept and genuinely does not exist in reanalysis
 * data (confirmed live: the field comes back null for every hour when
 * requested from archive). The archive instead reports the actual
 * measured `precipitation` amount (mm), which this returns as
 * `precipitationAmount` — a different, non-invented field, never used to
 * fake a probability.
 *
 * The nearest-hour matching below intentionally re-implements getForecast's
 * own small loop rather than extracting a shared helper — getForecast is
 * a live, UI-facing function (the Predictor/weather routes depend on it
 * unchanged); duplicating ~10 lines here is a safer trade than risking a
 * regression in that path for a refactor Phase 3.5 doesn't require.
 */

const ARCHIVE_BASE = "https://archive-api.open-meteo.com/v1/archive";
const ARCHIVE_FIELDS = "temperature_2m,precipitation,windspeed_10m,winddirection_10m,relative_humidity_2m,weathercode";

async function fetchHistoricalHourly(lat, lon, dateStr) {
    const key = `weather-historical:${lat}:${lon}:${dateStr}`;
    // Immutable past data — same TTL.HISTORICAL predictorService/
    // backtestDatasetService already use for other never-changing
    // historical Jolpica data.
    return cached(key, TTL.HISTORICAL, async () => {
        const url = `${ARCHIVE_BASE}?latitude=${lat}&longitude=${lon}&start_date=${dateStr}&end_date=${dateStr}&hourly=${ARCHIVE_FIELDS}&timezone=UTC`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Open-Meteo archive request failed");
        return response.json();
    });
}

// targetIso is expected to be the race's own scheduled date/time
// ("YYYY-MM-DDTHH:mm:ssZ") — known from the season schedule well before
// qualifying, so this is safe to call at either prediction stage; see
// predictionDataPolicy.js, where `weather` is a PRE_QUALIFYING-available
// category. Returns null (never a fabricated value) if the date is
// malformed, the archive has no data for it, or the nearest recorded
// hour is implausibly far from the target.
async function fetchPrimaryHistorical(lat, lon, targetIso, targetMs) {
    const dateStr = targetIso.slice(0, 10);
    const data = await fetchHistoricalHourly(lat, lon, dateStr);

    const times = data?.hourly?.time;
    if (!Array.isArray(times) || times.length === 0) return null;

    let bestIndex = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < times.length; i++) {
        const diff = Math.abs(new Date(`${times[i]}Z`).getTime() - targetMs);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestIndex = i;
        }
    }

    if (bestIndex === -1 || bestDiff > STALE_THRESHOLD_MS) return null;

    const hourly = data.hourly;
    return {
        provider: "open-meteo",
        observedFor: `${times[bestIndex]}Z`,
        airTemperature: hourly.temperature_2m?.[bestIndex] ?? null,
        precipitationAmount: hourly.precipitation?.[bestIndex] ?? null,
        windSpeed: hourly.windspeed_10m?.[bestIndex] ?? null,
        windDirection: hourly.winddirection_10m?.[bestIndex] ?? null,
        humidity: hourly.relative_humidity_2m?.[bestIndex] ?? null,
        weatherCode: hourly.weathercode?.[bestIndex] ?? null,
    };
}

// A genuinely past date has no second provider to fall back to — wttr.in
// only ever knows "today" onward — EXCEPT the one real-world case this
// route actually serves close to real time: a race that just finished
// within the last couple of days, where the archive hasn't ingested that
// day yet. There, wttr's current/near-term reading is a fair stand-in for
// "race-day conditions" and is clearly tagged `provider: "wttr"` rather
// than presented as if it were the archived reading.
async function getHistoricalWeather(lat, lon, targetIso) {
    const targetMs = new Date(targetIso).getTime();
    if (Number.isNaN(targetMs)) return null;

    try {
        const primary = await fetchPrimaryHistorical(lat, lon, targetIso, targetMs);
        if (primary) return primary;
    } catch {
        // falls through to the fallback provider below
    }

    const fallback = await fetchFallbackReading(lat, lon, targetMs);
    return fallback ? { ...fallback, observedFor: fallback.forecastFor } : null;
}

/*
 * Race-time weather for a COMPLETED race — the Live Dashboard's
 * post-race Weather panel. Two pieces, both from the same already-
 * fetched hourly archive (fetchHistoricalHourly), never invented:
 *   point      — the single nearest-hour reading to the race's actual
 *                start, same matching logic getHistoricalWeather already
 *                uses (reused via that function directly).
 *   condition  — how many of the archive's hourly samples that fall
 *                within [start, start+durationMs] (the race's own real
 *                elapsed time, from the winner's Results[0].Time.millis)
 *                were wet (precipitation > 0) vs dry. This is a genuine,
 *                if coarse, real distribution — a ~1.5h race usually
 *                only has 1-2 hourly samples in-window, which is still
 *                real data, just not granular. Only use this to render
 *                a donut when totalSamples > 0.
 */
async function getRaceWeather(lat, lon, startIso, durationMs) {
    const point = await getHistoricalWeather(lat, lon, startIso);

    const startMs = new Date(startIso).getTime();
    const dur = Number(durationMs);
    if (Number.isNaN(startMs) || !Number.isFinite(dur) || dur <= 0) {
        return point ? { point, condition: { drySamples: 0, wetSamples: 0, totalSamples: 0 } } : null;
    }
    const endMs = startMs + dur;

    let data;
    try {
        data = await fetchHistoricalHourly(lat, lon, startIso.slice(0, 10));
    } catch {
        return point ? { point, condition: { drySamples: 0, wetSamples: 0, totalSamples: 0 } } : null;
    }

    const times = data?.hourly?.time;
    let drySamples = 0;
    let wetSamples = 0;
    if (Array.isArray(times)) {
        times.forEach((t, i) => {
            const ms = new Date(`${t}Z`).getTime();
            if (ms < startMs || ms > endMs) return;
            const precip = data.hourly.precipitation?.[i];
            if (precip == null) return;
            if (precip > 0) wetSamples += 1;
            else drySamples += 1;
        });
    }

    if (!point && drySamples + wetSamples === 0) return null;
    return { point, condition: { drySamples, wetSamples, totalSamples: drySamples + wetSamples } };
}

module.exports = { getForecast, getHistoricalWeather, getRaceWeather };
