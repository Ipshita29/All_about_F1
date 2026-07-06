import { knowMoreInfo } from "../data/knowMoreInfo";

// Display order + chip label + short blurb for each category.
// Chip labels are shortened for the filter row (e.g. "Weekend Format" -> "Race Weekend").
export const CATEGORY_INFO = [
  { name: "Race Terms", chip: "Flags & Race", icon: "Flag", description: "Flags, safety cars, and the language of race day." },
  { name: "Strategy Terms", chip: "Strategy", icon: "Brain", description: "Undercuts, overcuts, and the pit-wall chess match." },
  { name: "Tyres", chip: "Tyres", icon: "Disc", description: "Compounds, degradation, and tyre pit strategy." },
  { name: "Car & Aerodynamics", chip: "Car", icon: "Car", description: "Downforce, drag, and the engineering behind the speed." },
  { name: "Weekend Format", chip: "Race Weekend", icon: "Calendar", description: "Practice, qualifying, and how a race weekend unfolds." },
  { name: "Timing & Gaps", chip: "Timing", icon: "Timer", description: "Sectors, deltas, and reading the timing screens." },
  { name: "Driver Results", chip: "Drivers", icon: "Users", description: "DNFs, penalties, and how results are decided." },
  { name: "Championship Terms", chip: "Championship", icon: "Trophy", description: "Points, standings, and the fight for the title." },
  { name: "Track Terms", chip: "Track", icon: "Map", description: "Apexes, kerbs, and the geometry of a circuit." },
  { name: "Weather Terms", chip: "Weather", icon: "CloudRain", description: "Rain, drying lines, and mixed-condition chaos." },
  { name: "Rules", chip: "Rules", icon: "BookOpen", description: "Parc fermé and the regulations behind the sport." },
];

export function getCategoryIcon(categoryName) {
  return CATEGORY_INFO.find((c) => c.name === categoryName)?.icon || "Flag";
}

export const POPULAR_SLUGS = [
  "drs",
  "safety-car",
  "undercut",
  "overcut",
  "pole-position",
  "parc-ferme",
  "dnf",
  "pit-stop",
];

export const SEARCH_PLACEHOLDERS = [
  "Search DRS...",
  "Search Pit Stop...",
  "Search Monaco...",
  "Search Safety Car...",
  "Search Tyre Deg...",
  "Search Undercut...",
  "Search Pole Position...",
];

export const DID_YOU_KNOW_FACTS = [
  "Monaco has the slowest average speed of any Formula 1 circuit.",
  "An F1 pit crew can change all four tyres in under 2.5 seconds.",
  "F1 cars can generate enough downforce to drive upside down through a tunnel.",
  "A Formula 1 steering wheel has more buttons than most video game controllers.",
  "Drivers lose up to 4kg in body weight during a hot, high-humidity Grand Prix.",
  "The chequered flag pattern predates motorsport, borrowed from 19th-century horse racing.",
  "F1 brakes can go from 300 km/h to a standstill in under 5 seconds.",
  "Every F1 car undergoes a mandatory FIA crash test before it's allowed to race.",
];

const EASTER_EGGS = {
  goat: "The GOAT debate never ends in F1 — Schumacher's 7 titles, Hamilton's 7, or Senna's raw speed? We'll let you decide.",
  senna: "\"Racing, competing, it's in my blood. It's part of me, it's part of my life.\" — Ayrton Senna",
  monaco: "Monaco is the only circuit where the harbour, not a grandstand, gives the best view of the finish line.",
};

let allTermsCache = null;

export function getAllTerms() {
  if (!allTermsCache) {
    allTermsCache = Object.values(knowMoreInfo).sort((a, b) => a.title.localeCompare(b.title));
  }
  return allTermsCache;
}

export function getTermBySlug(slug) {
  return getAllTerms().find((term) => term.slug === slug) || null;
}

export function getRandomTerm() {
  const terms = getAllTerms();
  return terms[Math.floor(Math.random() * terms.length)];
}

export function getRelatedTerms(term) {
  if (!term?.relatedTerms?.length) return [];
  return term.relatedTerms.map(getTermBySlug).filter(Boolean);
}

export function getCategoriesWithCounts() {
  const terms = getAllTerms();
  return CATEGORY_INFO.map((cat) => ({
    ...cat,
    count: terms.filter((t) => t.category === cat.name).length,
  })).filter((cat) => cat.count > 0);
}

export function matchesSearch(term, query) {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    term.title.toLowerCase().includes(q) ||
    term.category.toLowerCase().includes(q) ||
    term.meaning.toLowerCase().includes(q)
  );
}

export function getEasterEgg(query) {
  return EASTER_EGGS[query.trim().toLowerCase()] || null;
}

export function estimateReadingTime(term) {
  const words = [term.meaning, term.whyItMatters, term.example, term.beginnerTip, term.funFact]
    .filter(Boolean)
    .join(" ")
    .split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

const VISITED_KEY = "f1dict_visited_terms";

export function getVisitedSlugs() {
  try {
    return JSON.parse(localStorage.getItem(VISITED_KEY)) || [];
  } catch {
    return [];
  }
}

export function markTermVisited(slug) {
  const visited = new Set(getVisitedSlugs());
  visited.add(slug);
  localStorage.setItem(VISITED_KEY, JSON.stringify([...visited]));
}

export function getProgress() {
  return {
    visited: getVisitedSlugs().length,
    total: getAllTerms().length,
  };
}
