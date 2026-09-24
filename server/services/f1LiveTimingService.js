/**
 * Connects to F1's live timing SignalR feed and maintains
 * the latest session state in memory.
 *
 * No F1TV authentication or paid live-data service is used.
 * Some channels, such as telemetry and GPS, may be unavailable
 * without F1TV access and are therefore treated as optional.
 */

const WebSocket = require("ws");
const zlib = require("zlib");

const NEGOTIATE_URL = "https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1";
const WS_BASE = "wss://livetiming.formula1.com/signalrcore";
const STATIC_BASE = "https://livetiming.formula1.com/static/";

// F1's CDN blocks generic clients; this User-Agent (Unity's BestHTTP library,
// used by F1's own official apps) is what's empirically known to get through.
const HEADERS = {
    "User-Agent": "BestHTTP",
    Origin: "https://www.formula1.com",
    Referer: "https://www.formula1.com/",
};

const TOPICS = [
    "Heartbeat", "DriverList", "SessionInfo", "SessionStatus", "TimingData",
    "TimingAppData", "TimingStats", "TrackStatus", "WeatherData",
    "Position.z", "CarData.z", "RaceControlMessages", "TeamRadio",
    "SessionData", "TopThree", "LapCount", "ExtrapolatedClock",
];

const BASE_RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 60000;
const MAX_RACE_CONTROL = 50;
const MAX_TEAM_RADIO = 30;
const RECORD_SEPARATOR = "\u001e";

// ---------------------------------------------------------------------------
// In-memory live state
// ---------------------------------------------------------------------------

const state = {
    connectionStatus: "disconnected", // disconnected | connecting | connected
    sessionInfo: null, // raw SessionInfo payload
    sessionStatus: null, // "Started" | "Finalised" | "Inactive" | ...
    driverList: {}, // racingNumber -> DriverList entry
    timingData: {}, // racingNumber -> TimingData.Lines entry
    timingAppData: {}, // racingNumber -> TimingAppData.Lines entry
    timingStats: {}, // racingNumber -> TimingStats.Lines entry
    trackStatus: null,
    weather: null,
    raceControl: [], // bounded, most recent last
    teamRadio: [], // bounded, most recent last
    carData: {}, // racingNumber -> decoded latest (expected to stay empty, unauthenticated)
    location: {}, // racingNumber -> decoded latest (expected to stay empty, unauthenticated)
    lapCount: null,
    updatedAt: null,
};

function resetLiveState() {
    state.driverList = {};
    state.timingData = {};
    state.timingAppData = {};
    state.timingStats = {};
    state.trackStatus = null;
    state.weather = null;
    state.raceControl = [];
    state.teamRadio = [];
    state.carData = {};
    state.location = {};
    state.lapCount = null;
}

function touch() {
    state.updatedAt = new Date().toISOString();
}

function isPlainObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(target, patch) {
    if (!isPlainObject(target) || !isPlainObject(patch)) return patch;
    const result = { ...target };
    for (const [key, value] of Object.entries(patch)) {
        result[key] = isPlainObject(value) && isPlainObject(target[key]) ? deepMerge(target[key], value) : value;
    }
    return result;
}

function mergeLines(store, payload) {
    const lines = payload?.Lines;
    if (!isPlainObject(lines)) return;
    for (const [num, patch] of Object.entries(lines)) {
        store[num] = deepMerge(store[num] || {}, patch);
    }
}

function decompressZ(base64) {
    try {
        return JSON.parse(zlib.inflateRawSync(Buffer.from(base64, "base64")).toString("utf-8"));
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Channel dispatch
// ---------------------------------------------------------------------------

function applyChannelUpdate(channel, payload) {
    touch();

    switch (channel) {
        case "DriverList":
            if (isPlainObject(payload)) {
                for (const [num, patch] of Object.entries(payload)) {
                    if (num === "_kf") continue;
                    state.driverList[num] = deepMerge(state.driverList[num] || {}, patch);
                }
            }
            break;
        case "TimingData":
            mergeLines(state.timingData, payload);
            break;
        case "TimingAppData":
            mergeLines(state.timingAppData, payload);
            break;
        case "TimingStats":
            mergeLines(state.timingStats, payload);
            break;
        case "SessionInfo":
            state.sessionInfo = payload;
            break;
        case "SessionStatus":
            state.sessionStatus = payload?.Status ?? state.sessionStatus;
            break;
        case "TrackStatus":
            state.trackStatus = payload;
            break;
        case "WeatherData":
            state.weather = payload;
            break;
        case "LapCount":
            state.lapCount = payload;
            break;
        case "RaceControlMessages": {
            const messages = payload?.Messages;
            if (Array.isArray(messages)) {
                for (const m of messages) {
                    state.raceControl.push(m);
                }
                if (state.raceControl.length > MAX_RACE_CONTROL) {
                    state.raceControl = state.raceControl.slice(-MAX_RACE_CONTROL);
                }
            }
            break;
        }
        case "TeamRadio": {
            const captures = payload?.Captures;
            if (Array.isArray(captures)) {
                for (const c of captures) {
                    state.teamRadio.push(c);
                }
                if (state.teamRadio.length > MAX_TEAM_RADIO) {
                    state.teamRadio = state.teamRadio.slice(-MAX_TEAM_RADIO);
                }
            }
            break;
        }
        case "Position.z": {
            const decoded = decompressZ(payload);
            if (decoded?.Position) {
                for (const frame of decoded.Position) {
                    for (const [num, entry] of Object.entries(frame.Entries || {})) {
                        state.location[num] = { ...entry, timestamp: frame.Timestamp };
                    }
                }
            }
            break;
        }
        case "CarData.z": {
            const decoded = decompressZ(payload);
            if (decoded?.Entries) {
                for (const frame of decoded.Entries) {
                    for (const [num, channels] of Object.entries(frame.Cars || {})) {
                        state.carData[num] = { ...channels.Channels, timestamp: frame.Utc };
                    }
                }
            }
            break;
        }
        default:
            break;
    }
}

// ---------------------------------------------------------------------------
// Connection lifecycle
// ---------------------------------------------------------------------------

let ws = null;
let reconnectAttempts = 0;
let reconnectTimer = null;
let handshakeDone = false;
let lastSessionPath = null;

async function connect() {
    state.connectionStatus = "connecting";
    try {
        const negRes = await fetch(NEGOTIATE_URL, { method: "POST", headers: HEADERS });
        if (!negRes.ok) throw new Error(`negotiate failed (${negRes.status})`);

        const setCookie = negRes.headers.get("set-cookie");
        const cookie = setCookie ? setCookie.split(",").map((c) => c.trim().split(";")[0]).join("; ") : "";
        const neg = await negRes.json();
        if (!neg.connectionToken) throw new Error("negotiate response missing connectionToken");

        handshakeDone = false;
        ws = new WebSocket(`${WS_BASE}?id=${neg.connectionToken}`, { headers: { ...HEADERS, Cookie: cookie } });
        attachListeners();
    } catch (error) {
        console.error(`[F1Live] Connection attempt failed: ${error.message}`);
        state.connectionStatus = "disconnected";
        scheduleReconnect();
    }
}

function attachListeners() {
    ws.on("open", () => {
        ws.send(JSON.stringify({ protocol: "json", version: 1 }) + RECORD_SEPARATOR);
    });

    ws.on("message", (raw) => {
        for (const chunk of raw.toString("utf-8").split(RECORD_SEPARATOR)) {
            if (!chunk) continue;
            let msg;
            try {
                msg = JSON.parse(chunk);
            } catch {
                continue;
            }
            handleFrame(msg);
        }
    });

    ws.on("close", () => {
        state.connectionStatus = "disconnected";
        scheduleReconnect();
    });

    ws.on("error", (error) => {
        console.error(`[F1Live] WebSocket error: ${error.message}`);
    });
}

function handleFrame(msg) {
    if (!handshakeDone) {
        handshakeDone = true;
        if (msg.error) {
            console.error(`[F1Live] Handshake rejected: ${msg.error}`);
            ws.close();
            return;
        }
        state.connectionStatus = "connected";
        reconnectAttempts = 0;
        ws.send(JSON.stringify({ type: 1, target: "Subscribe", arguments: [TOPICS], invocationId: "1" }) + RECORD_SEPARATOR);
        return;
    }

    // Subscribe completion: initial full snapshot for every channel.
    if (msg.type === 3 && msg.invocationId === "1") {
        if (msg.error) {
            console.error(`[F1Live] Subscribe rejected: ${msg.error}`);
            return;
        }
        for (const [channel, payload] of Object.entries(msg.result || {})) {
            applyChannelUpdate(channel, payload);
        }
        checkSessionChange();
        return;
    }

    // Live incremental push.
    if (msg.type === 1 && msg.target === "feed") {
        const [channel, payload] = msg.arguments || [];
        if (!channel) return;
        applyChannelUpdate(channel, payload);
        if (channel === "SessionInfo") checkSessionChange();
    }
}

function checkSessionChange() {
    const path = state.sessionInfo?.Path;
    if (!path) return;
    if (lastSessionPath === null) {
        lastSessionPath = path;
        return;
    }
    if (path !== lastSessionPath) {
        lastSessionPath = path;
        resetLiveState();
    }
}

function scheduleReconnect() {
    if (reconnectTimer) return;
    const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY_MS);
    reconnectAttempts++;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
    }, delay);
    reconnectTimer.unref?.();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let initialized = false;

function init() {
    if (initialized) return;
    initialized = true;
    connect();
}

function getState() {
    return state;
}

function teamRadioUrl(capture) {
    const sessionPath = state.sessionInfo?.Path;
    if (!sessionPath || !capture?.Path) return null;
    return `${STATIC_BASE}${sessionPath}${capture.Path}`;
}

module.exports = { init, getState, teamRadioUrl };
