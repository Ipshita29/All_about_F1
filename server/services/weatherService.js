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

module.exports = { getForecast };
