/*
 * Single source of truth for the backend base URL. Every page used to
 * hardcode `http://localhost:3000` independently — fine for local dev,
 * but it meant the frontend could never point at a deployed backend
 * without editing source in ~17 files. Set VITE_API_URL in the client's
 * environment (e.g. on Vercel) to point at the production backend;
 * locally, with no env file, it falls back to localhost exactly as
 * before.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
