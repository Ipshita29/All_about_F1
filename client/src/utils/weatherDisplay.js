/*
 * Shared presentation helpers for rendering a weather reading returned
 * by server/services/weatherService.js (same WMO condition codes
 * Open-Meteo uses, regardless of whether the reading actually came from
 * Open-Meteo or the wttr.in fallback — the backend normalizes both onto
 * this one code space before it ever reaches the client).
 */
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Cloudy, Sun } from "lucide-react";

export const WMO_CONDITIONS = {
    0: { label: "Clear sky", Icon: Sun },
    1: { label: "Mostly clear", Icon: CloudSun },
    2: { label: "Partly cloudy", Icon: CloudSun },
    3: { label: "Overcast", Icon: Cloudy },
    45: { label: "Fog", Icon: CloudFog },
    48: { label: "Freezing fog", Icon: CloudFog },
    51: { label: "Light drizzle", Icon: CloudDrizzle },
    53: { label: "Drizzle", Icon: CloudDrizzle },
    55: { label: "Dense drizzle", Icon: CloudDrizzle },
    56: { label: "Freezing drizzle", Icon: CloudDrizzle },
    57: { label: "Freezing drizzle", Icon: CloudDrizzle },
    61: { label: "Light rain", Icon: CloudRain },
    63: { label: "Rain", Icon: CloudRain },
    65: { label: "Heavy rain", Icon: CloudRain },
    66: { label: "Freezing rain", Icon: CloudRain },
    67: { label: "Freezing rain", Icon: CloudRain },
    71: { label: "Light snow", Icon: CloudSnow },
    73: { label: "Snow", Icon: CloudSnow },
    75: { label: "Heavy snow", Icon: CloudSnow },
    77: { label: "Snow grains", Icon: CloudSnow },
    80: { label: "Rain showers", Icon: CloudRain },
    81: { label: "Rain showers", Icon: CloudRain },
    82: { label: "Violent showers", Icon: CloudRain },
    85: { label: "Snow showers", Icon: CloudSnow },
    86: { label: "Snow showers", Icon: CloudSnow },
    95: { label: "Thunderstorm", Icon: CloudLightning },
    96: { label: "Thunderstorm, hail", Icon: CloudLightning },
    99: { label: "Thunderstorm, hail", Icon: CloudLightning },
};

export function weatherCondition(code) {
    return WMO_CONDITIONS[code] ?? { label: "—", Icon: Cloud };
}

const COMPASS_POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

export function compassDirection(deg) {
    if (deg == null) return null;
    return COMPASS_POINTS[Math.round(deg / 22.5) % 16];
}
