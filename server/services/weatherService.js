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

async function getForecast(lat, lon, targetIso) {
    const data = await fetchHourly(lat, lon);
    const times = data?.hourly?.time;
    if (!Array.isArray(times) || times.length === 0) return null;

    const targetMs = new Date(targetIso).getTime();
    if (Number.isNaN(targetMs)) return null;

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
async function getHistoricalWeather(lat, lon, targetIso) {
    const targetMs = new Date(targetIso).getTime();
    if (Number.isNaN(targetMs)) return null;

    const dateStr = targetIso.slice(0, 10);
    let data;
    try {
        data = await fetchHistoricalHourly(lat, lon, dateStr);
    } catch {
        return null;
    }

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
        observedFor: `${times[bestIndex]}Z`,
        airTemperature: hourly.temperature_2m?.[bestIndex] ?? null,
        precipitationAmount: hourly.precipitation?.[bestIndex] ?? null,
        windSpeed: hourly.windspeed_10m?.[bestIndex] ?? null,
        windDirection: hourly.winddirection_10m?.[bestIndex] ?? null,
        humidity: hourly.relative_humidity_2m?.[bestIndex] ?? null,
        weatherCode: hourly.weathercode?.[bestIndex] ?? null,
    };
}

module.exports = { getForecast, getHistoricalWeather };
