# LANDING_PAGE_REDESIGN_GUIDE.md

A complete walkthrough of the cinematic landing-page redesign: what changed,
every file created or modified, how data flows, how each animation works, and
how to test it. Only the landing page, the shared Navbar, and landing-scoped
additions were touched — all other pages, routes, backend code and auth flows
are unchanged.

---

## 1. What changed

The old landing page (hero image + stat bar + 3D Ferrari + stacked cards) was
replaced with a single connected experience:

1. **Cinematic intro (`F1Intro`)** — once per browser session, a near-black
   screen; an F1 car crosses left→right with speed lines and a red light
   trail, then the overlay wipes away left-to-right to reveal the hero.
2. **Typography hero (`HeroReveal`)** — giant “ALL ABOUT F1” wordmark with
   the tagline `THE GRID. THE SPEED. THE STORIES.` Moving the cursor over the
   type reveals a red-lit version of the letters and a faint car silhouette
   in a soft window around the cursor (CSS mask). Touch devices get a slow
   automatic sweep; reduced motion gets a static partial reveal.
3. **Personalization invite (`GridInvite`)** — logged-out visitors only,
   slides in bottom-right after ~8 s (`MAKE THE GRID YOURS`), links to the
   existing `/auth` page, dismissible, never re-shown in the same session.
4. **Live Race Center (`LiveRaceCenter`)** — a timing-screen styled section.
   If “now” is inside a scheduled session window it shows a LIVE header and a
   dense timing board (honestly labelled as championship-standings order —
   there is no live-timing feed in this project). Otherwise it becomes the
   NEXT SESSION state with a mono countdown and the weekend schedule.
5. **Upcoming GP garage (`NextGpGarage`)** — `NEXT ON THE CALENDAR` with
   round, circuit, locality, weekend dates, a large D/H/M/S countdown to the
   race, the local circuit map (inverted, blueprint style) and the session
   schedule. Ceiling lights switch on once as the section scrolls into view.
6. **Podium (`PodiumSection`)** — P3–P1–P2 visual hierarchy for any completed
   round, selected through a custom keyboard-accessible race selector
   (defaults to the latest race). Shows portrait, name, number, team, points,
   and a real positions-gained indicator computed from Ergast `grid` data.
   Portraits support the helmet-image cursor reveal (see ASSETS_REQUIRED.md).
7. **Championship (`ChampionshipSection`)** — one section with an accessible
   `DRIVERS | CONSTRUCTORS` tab toggle. Ghost driver numbers, points, and
   `N PTS TO P1` gaps instead of progress bars. Constructor rows reserve a
   hover-animated car-asset slot.
8. **News (`PaddockNews`)** — `FROM THE PADDOCK`: one featured article + three
   supporting stories from the existing `/news` backend, with source,
   relative publish time and a `FOR YOU` tag when an article mentions the
   user's favourite driver/team.
9. **Pit Wall Radio (`PitWallRadio`)** — replaces the Word of the Day popup on
   the landing page (the old `WordOfTheDay.jsx` component still exists,
   untouched — it is simply no longer rendered here). A floating, text-only
   radio tab appears after the hero, addresses the user by first name,
   expands into today's dictionary term (same deterministic daily rotation as
   before via `getWordOfTheDay()`), and hides while the footer is visible.
   No audio, no play affordances.
10. **Explore (`ExploreGrid`)** — asymmetric editorial grid of 8 tiles
    (Drivers, Teams, Grand Prix, Circuits, Dictionary, News, Driver
    Comparison, Race Center), each with one restrained hover interaction and
    all linking to verified existing routes.
11. **Garage footer (`GarageFooter`)** — the intro car returns, parked in a
    garage bay; lights switch on once in view and the rear light pulses once.
    Grouped navigation, copyright, `LIGHTS OUT. SEE YOU AT THE NEXT RACE.`
12. **Navbar** — new `ALL ABOUT F1` wordmark, trimmed primary nav (Race
    Center / Drivers / Teams), an accessible Explore dropdown (Circuits,
    Dictionary, News, Driver Comparison, Team Comparison), existing auth
    controls. On the landing route it is fixed and transparent over the hero,
    becoming solid dark after scrolling; every other page keeps the original
    light navbar look.

**Personalization** never filters content — favourites only add accents: row
highlights on the timing board and championship lists, a `YOUR PICK` tag on
the podium, `FOR YOU` on news, the user's first name and team-colour accent
on the radio.

**Colour system** (defined as CSS variables in `LandingPage.css`, scoped to
`.lp`): `#141616` background, `#3D3C38` surfaces, `#746D67` borders,
`#A49F9D` secondary text, `#7F1D1A` racing red (with `#B3271E` as a brighter
functional variant for small highlights on dark), off-white `#F2F0ED` text.
Team colours appear only on team strips, favourite accents and the radio.

---

## 2. Files created

### `client/src/components/landing/F1CarSilhouette.jsx`
- **Purpose:** the one shared car visual. Exports `F1CarSilhouette` (named —
  the SVG side view with wheel groups, accent stripe, rear light) and a
  default `CarVisual` wrapper that renders a real PNG when `CAR_IMAGE_SRC`
  is set (see ASSETS_REQUIRED.md) and the SVG otherwise.
- **Props:** `className`. **State:** `imgFailed` (falls back to SVG if the
  configured PNG 404s). **Data source:** none.
- **Connects to:** `F1Intro`, `HeroReveal`, `ExploreGrid`, `GarageFooter`.

### `client/src/components/landing/F1Intro.jsx`
- **Purpose:** once-per-session intro overlay.
- **State:** `visible` (initialised from `sessionStorage["aaf1_intro_seen"]`).
- **Hooks:** `useReducedMotion`; one `setTimeout` (cleaned up) unmounts the
  overlay at ~1.55 s (0.45 s reduced). Adds/removes `lp-no-scroll` on `<body>`.
- **Connects to:** rendered first by `LandingPage`; all motion lives in
  `LandingPage.css` (`lp-intro-*` keyframes).

### `client/src/components/landing/HeroReveal.jsx`
- **Purpose:** interactive typography hero.
- **State:** none (deliberately). A `pointermove` listener writes `--hx`,
  `--hy`, `--hshift` custom properties inside one `requestAnimationFrame`,
  so cursor tracking causes **zero React re-renders**.
- **Hooks:** `useRef` (section + rAF id), `useEffect` (listener add/remove +
  rAF cancel), `useReducedMotion` (skips the listener entirely).
- **Connects to:** `#race-center` anchor scrolls into `LiveRaceCenter`.

### `client/src/components/landing/GridInvite.jsx`
- **Purpose:** delayed login invitation (logged-out only).
- **Props:** `isAuthenticated`. **State:** `visible`.
- **Behaviour:** 8 s `setTimeout` (cleaned up); dismissal stored in
  `sessionStorage["aaf1_invite_dismissed"]`; primary action `Link` →
  existing `/auth` flow; Escape dismisses.

### `client/src/components/landing/LiveRaceCenter.jsx`
- **Purpose:** timing-screen section; LIVE state vs NEXT SESSION state.
- **Props:** `liveSession`, `nextSession` (both computed in `LandingPage`
  from the schedule), `driverStandings`, `favs`, `scheduleError`.
- **Hooks:** `useCountdown` for the next-session timer.
- **Internal pieces:** `TimingBoard` (dense rows, team-colour strips,
  favourite highlight, honesty caption), `ScheduleList` (weekend sessions
  with done/next markers).
- **Data source:** props only — no fetching here.

### `client/src/components/landing/NextGpGarage.jsx`
- **Purpose:** upcoming GP garage section.
- **Props:** `race` (the next race object). **State:** `mapFailed`.
- **Hooks:** `useInViewOnce` (garage lights switch on once), `useCountdown`
  (race-start countdown).
- **Data source:** `race` prop; circuit image from
  `/circuits/<circuitId>/map.png` with an SVG blueprint fallback.

### `client/src/components/landing/PodiumSection.jsx`
- **Purpose:** podium + historical GP selector.
- **Props:** `completedRaces`, `latestRace`, `favs`.
- **State:** `selectedKey` (chosen round), `fetched` (per-round results cache
  `{ key: { status, data } }`); portrait sub-state `helmetOk`, `swapped`.
- **Hooks:** `useEffect` fetches `/grandprixdashboard/results/:year/:round`
  only when the selected round isn't already available (latest race results
  arrive preloaded via `/grandprixdashboard/latest`), with a `cancelled`
  guard.
- **Internal pieces:** `RaceSelector` (custom listbox: ArrowUp/Down, Home,
  End, Enter, Escape, outside click, `aria-activedescendant`),
  `PodiumPortrait` (dual-image cursor mask; touch tap swaps; monogram
  fallback), `GainedIndicator` (real `grid − position` delta; hidden for
  pit-lane starts where `grid` is 0).

### `client/src/components/landing/ChampionshipSection.jsx`
- **Purpose:** drivers/constructors championship with tab toggle.
- **Props:** `driverStandings`, `constructorStandings`, `favs`.
- **State:** `view` (`"drivers" | "constructors"`); `TeamCarImage` keeps a
  `failed` flag so missing `/cars/*.png` assets render nothing.
- **Accessibility:** real `role="tablist"` pattern with ArrowLeft/Right and
  roving tabindex; panels are `role="tabpanel"` with `hidden`.

### `client/src/components/landing/PaddockNews.jsx`
- **Purpose:** editorial news (1 featured + 3 supporting).
- **Props:** `articles`, `favs`, `error`.
- **Data source:** props (fetched once in `LandingPage` from `/news`).
- Broken external images add an `is-imgless` class that hides the frame.

### `client/src/components/landing/PitWallRadio.jsx`
- **Purpose:** floating daily-term radio.
- **Props:** `user`, `favs`, `footerRef`.
- **State:** `term` (from `getWordOfTheDay()`, once), `pastHero`,
  `footerVisible`, `open`.
- **Hooks:** scroll listener (passive, removed on unmount);
  IntersectionObserver on the footer wrapper; document-level Escape/outside
  listeners only while open. Collapsed tab is removed from the tab order
  (`tabIndex -1`) while hidden.
- **Data source:** existing dictionary data (`knowMoreInfo`) through the
  existing helper — no duplicate definitions.

### `client/src/components/landing/ExploreGrid.jsx`
- **Purpose:** asymmetric discovery grid; 8 tiles → verified routes
  (`/drivers`, `/teams`, `/grandprixdashboard`, `/circuitmaps`,
  `/dictionary`, `/news`, `/compare-drivers`, `/grandprixdashboard`).
- **State/hooks:** none — all tile interactions are pure CSS on
  `:hover`/`:focus-visible`.

### `client/src/components/landing/GarageFooter.jsx`
- **Purpose:** landing-only footer with the parked intro car.
- **Props:** `isAuthenticated` (switches the GARAGE link group between
  Sign In and Profile/Preferences).
- **Hooks:** `useInViewOnce` → `lp-footer--lit` (lights + one rear-light pulse).

### `client/src/utils/landingHelpers.js`
- **Purpose:** all landing data logic, kept out of components:
  favourite-team→constructorId map, team colours from `teamInfo`, local
  driver portrait/helmet lookup, driver codes/initials,
  `buildFavourites` / `isFavouriteDriver` / `isFavouriteTeam`,
  `getWeekendSessions` / `findNextSession` / `findLiveSession` (session
  windows: practice/quali 60 min, sprint quali 45, sprint 60, race 180),
  `getCompletedRaces`, `formatWeekendRange`, `circuitMapSrc`,
  `pointsToLeader`, `positionsGained`, `articleIsForYou`, `formatArticleTime`.
- **Data source:** static imports of `teamInfo` / `driverInfo`.

### `client/src/hooks/useCountdown.js`
- Ticking D/H/M/S toward a target; interval cleared on unmount/target change;
  re-syncs via state-adjustment-during-render when the target changes.

### `client/src/hooks/useInViewOnce.js`
- `[ref, inView]`; IntersectionObserver disconnects after first intersection
  so scroll effects fire exactly once.

### `client/src/hooks/useReducedMotion.js`
- Live `prefers-reduced-motion` boolean with a media-query listener.

### `client/src/pages/LandingPage.css`
- The entire landing stylesheet (~1,500 lines), scoped under `.lp` /
  `lp-`-prefixed classes so nothing leaks into the light-themed site.
  Contains the colour variables, section scaffolding (shared rules + red
  kerb ticks between sections), and every animation described in §6.

### Root docs
- `ASSETS_REQUIRED.md` — optional assets, exact paths, fallbacks.
- `LANDING_PAGE_REDESIGN_GUIDE.md` — this file.

---

## 3. Files modified

### `client/src/pages/LandingPage.jsx` (rewritten)
- **Why:** it is the landing page.
- **Now:** a thin orchestrator — fetches all data (same endpoints as before:
  season schedule, profile, driver/constructor standings, latest race, news),
  derives `liveSession` / `nextSession` / `completedRaces` / `favs` with
  `useMemo` (re-derived once a minute via a 60 s tick so a session can flip
  to LIVE without reloading), and composes the section components in order.
- **Removed from the page:** the old hero, stats bar, 3D Ferrari showcase,
  welcome banner, card-style sections, `WordOfTheDay` usage. The components
  `Ferrari3D.jsx`, `WordOfTheDay.jsx`, `LoadingSpinner.jsx` were **not
  deleted or modified** — they're simply no longer rendered on this page.
- **Preserved behaviour:** same backend endpoints, same auth token handling,
  favourite driver/team still read from `/user/profile`.

### `client/src/components/Navbar.jsx` (restructured — shared component)
- **Why:** section 11 of the redesign (header) — this is the one intentional
  shared-scope change.
- **Added:** `ALL ABOUT F1` wordmark (replaces the logo image), primary
  links (Race Center, Drivers, Teams), Explore dropdown (button with
  `aria-haspopup`/`aria-expanded`, Escape + outside-click close, closes on
  navigation), scroll state, landing-only classes `navbar--landing` /
  `navbar--top`, mobile menu now lists Home + all links flat.
- **Preserved:** token check, Sign In / Preferences / Profile / Sign Out
  controls and handlers, hamburger behaviour, active-route logic, all
  existing class names (so other pages keep their look).

### `client/src/App.css` (append-only)
- **Why:** navbar styles live here; the new markup needed styles for
  `.navbar-wordmark`, `.navbar-explore*`, and the `.navbar--landing` /
  `.navbar--top` dark/transparent variants.
- **Nothing was removed or edited** — additions start at the
  `/* ── Navbar redesign: ... ── */` comment at the end of the file.
- Note: the old landing-page styles earlier in App.css (`.landing-hero`,
  `.podium-card`, `.news-preview-*`, `.wotd-*`, etc.) are now unused by the
  landing page but were intentionally left in place because some are shared
  visual patterns and removing them risks other pages; they can be pruned
  later if you confirm nothing else uses them.

Nothing else was modified. `App.jsx`, all routes, the server, and every other
page are byte-identical.

---

## 4. Reading order

1. `client/src/pages/LandingPage.jsx` — data fetching + page composition.
2. `client/src/utils/landingHelpers.js` — every derived value used below.
3. `client/src/hooks/useCountdown.js`, `useInViewOnce.js`, `useReducedMotion.js`.
4. `client/src/pages/LandingPage.css` — read top-to-bottom alongside each
   component; it is organised in the same order as the page.
5. `client/src/components/landing/F1CarSilhouette.jsx` — the shared car.
6. `client/src/components/landing/F1Intro.jsx` — intro overlay.
7. `client/src/components/landing/HeroReveal.jsx` — hero + cursor mask.
8. `client/src/components/landing/GridInvite.jsx`.
9. `client/src/components/landing/LiveRaceCenter.jsx`.
10. `client/src/components/landing/NextGpGarage.jsx`.
11. `client/src/components/landing/PodiumSection.jsx` (selector → portrait → section).
12. `client/src/components/landing/ChampionshipSection.jsx`.
13. `client/src/components/landing/PaddockNews.jsx`.
14. `client/src/components/landing/PitWallRadio.jsx`.
15. `client/src/components/landing/ExploreGrid.jsx`.
16. `client/src/components/landing/GarageFooter.jsx`.
17. `client/src/components/Navbar.jsx` + the appended block in `client/src/App.css`.

---

## 5. Data flow

All requests start in `LandingPage.jsx` (one `useEffect` per endpoint, all
with `.catch`), hit the existing Express backend on `http://localhost:3000`,
and flow down as plain props:

| Fetch (in LandingPage) | Backend route | External API | Stored in | Consumed by |
|---|---|---|---|---|
| season schedule | `GET /grandprixdashboard/2026` | Jolpica | `races` (+ `scheduleError`) | derived `liveSession`/`nextSession`/`completedRaces` → `LiveRaceCenter`, `NextGpGarage`, `PodiumSection` |
| profile (only if token) | `GET /user/profile` | MongoDB | `user` | `favs` (via `buildFavourites`) → highlights everywhere; `PitWallRadio` name |
| driver standings | `GET /drivers/standings/2026` | Jolpica | `driverStandings` | `LiveRaceCenter` board, `ChampionshipSection` |
| constructor standings | `GET /teams/standings/2026` | Jolpica | `constructorStandings` | `ChampionshipSection` |
| latest race | `GET /grandprixdashboard/latest` | Jolpica | `latestRace` | `PodiumSection` default selection (results preloaded) |
| news | `GET /news` | NewsAPI | `newsArticles` (+ `newsError`) | `PaddockNews` |
| historical results | `GET /grandprixdashboard/results/:year/:round` | Jolpica | `PodiumSection`-local `fetched` cache | podium for non-latest rounds (fetched once per round, cached) |

- **Auth:** unchanged — JWT in `localStorage("token")`; the profile fetch is
  skipped without it. `isAuthenticated` is just `Boolean(token)`, exactly
  like the Navbar's existing check.
- **Favourites:** `buildFavourites(user)` normalises
  `favoriteTeam` (Preferences label → Jolpica constructorId via
  `FAV_TEAM_TO_CONSTRUCTOR_ID`) and `favoriteDriver` (matched by family
  name so “Kimi Antonelli” matches Jolpica's “Andrea Kimi Antonelli”), plus
  the team's primary colour from `teamInfo`. Components call
  `isFavouriteDriver` / `isFavouriteTeam` per row.
- **Loading / error / empty:** each section owns an honest state — the Race
  Center shows “SESSION SCHEDULE UNAVAILABLE …” on fetch failure; the podium
  shows LOADING / UNAVAILABLE / “NO CLASSIFICATION PUBLISHED … YET”; news
  shows a feed-unavailable line; standings tabs say “… UNAVAILABLE”. No
  fake data is ever presented as real; the only synthetic display (timing
  board order during a live window) is labelled on-screen.

---

## 6. Animation explanations

All animations are **CSS-first**; JavaScript only toggles classes or writes
CSS custom properties. No animation library was added.

| Animation | File(s) | Technique | Why | Cleanup | Reduced motion | Mobile |
|---|---|---|---|---|---|---|
| Intro drive-by + speed lines + trail + wipe | `F1Intro.jsx` + `lp-intro-*` in `LandingPage.css` | CSS keyframes (`transform` only) on an SVG/PNG car; overlay exit via animated `clip-path`; tiny camera-shake keyframes | GPU-friendly transforms; one `setTimeout` unmounts everything — no JS animation loop | timeout cleared + `lp-no-scroll` removed in effect cleanup; whole overlay unmounts | `.lp-intro--reduced`: static scene, quick fade, no movement | shorter/smaller car via media query; same duration budget |
| Wheel spin | `F1CarSilhouette.jsx` wheel groups + `lp-wheel-spin` | CSS `rotate` on SVG `<g>` with fixed `transform-origin` | keeps the silhouette honest at speed with zero JS | unmounts with the intro | disabled (animations flattened) | same |
| Hero cursor reveal | `HeroReveal.jsx` + `.lp-hero-word--reveal` / `.lp-hero-carlayer` | `radial-gradient` **CSS mask** positioned by `--hx/--hy`; duplicate headline uses `background-clip: text`; parallax via `translateX(calc(var(--hshift) * 36px))` | masks composite on the GPU; writing custom properties in rAF avoids React re-renders entirely | listeners + rAF cancelled in effect cleanup | listener never attached; static larger mask at 55 % opacity (CSS) | `@media (hover: none)`: `@property`-registered `--hx/--hy` animate in a slow 10 s alternate sweep |
| Kicker dot / LIVE dot / radio blink | CSS `lp-pulse` | opacity keyframes | restrained “signal” language | n/a (pure CSS) | disabled | same |
| Garage & footer lights | `NextGpGarage.jsx` / `GarageFooter.jsx` + `lp-garage--lit` / `lp-footer--lit` | `useInViewOnce` adds a class once; CSS transitions on background/box-shadow with staggered delays | IntersectionObserver disconnects after first hit — no scroll listeners | observer disconnected in cleanup | content shown at full opacity immediately | identical |
| Footer rear-light pulse | `lp-rearlight` keyframes | SVG fill/filter animated **once** (`animation-iteration-count: 1`) | the “car has parked” beat | runs once, no loop | flattened to instant | identical |
| Podium helmet reveal | `PodiumSection.jsx` + `.lp-podium-portrait.has-helmet` | same rAF + `--px/--py` mask technique as the hero, applied to a second aligned `<img>` | premium effect reserved for podium portraits only | rAF cancelled on unmount; listeners are React props | cursor-driven (not time-based), so it remains; nothing autoplays | tap toggles full image swap (`is-swapped`) |
| Countdowns | `useCountdown.js` | 1 s `setInterval` updating text (`font-variant-numeric: tabular-nums` prevents layout shift) | data, not decoration | interval cleared on unmount/target change | still ticks (information, not motion) | identical |
| Explore tile micro-interactions | `ExploreGrid.jsx` + `lp-explore-*` | pure CSS on `:hover`/`:focus-visible`: car `translateX`, circuit `stroke-dashoffset` draw, term-cycle opacity keyframes, ticker `translateX`, digit swap | only the hovered tile animates; zero idle motion | n/a | flattened by the global reduced-motion block | hover effects simply don't trigger; tiles stay static links |
| Navbar transparent→solid | `Navbar.jsx` + `.navbar--landing` | scroll listener toggles a class; CSS transitions background/border | cheap boolean state; passive listener | listener removed on unmount | class flip still works (transition shortened) | identical |
| Radio slide / invite slide | CSS transforms + `lp-invite-in` | translate/opacity transitions | non-intrusive entrances | listeners removed when closed/unmounted | flattened | radio docks bottom-right, quote hidden on small screens |

A global `@media (prefers-reduced-motion: reduce)` block at the end of
`LandingPage.css` flattens every animation/transition inside `.lp` as a
safety net, then restores full opacity for content that would otherwise wait
for a scroll-in effect.

---

## 7. Assets

**Reused existing assets:** circuit maps
(`/circuits/<circuitId>/map.png` — Jolpica circuitIds verified to match the
folder names), driver portraits (`/drivers/*.png` via `driverInfo`), team
colours (`teamInfo.teamColors`), dictionary content (`knowMoreInfo`).
Remote `driverInfo` images (Wikimedia) are deliberately **not** used on the
landing page — only local files, per the no-unstable-URLs rule.

**New optional assets** (everything has a designed fallback):
`/images/car-side.png`, `/drivers/helmets/*.png`, `/cars/<constructorId>.png`
— full specs, search terms, activation steps and fallbacks in
**ASSETS_REQUIRED.md**.

---

## 8. Dependencies

**None added.** The redesign uses React, react-router-dom, `lucide-react`
(already installed, used for the ×/chevron icons), CSS, SVG and browser APIs
(IntersectionObserver, matchMedia, sessionStorage, requestAnimationFrame).
`package.json` is untouched.

---

## 9. How to test

Run the backend (`cd server && node index.js`) and client
(`cd client && npm run dev`). `npm run build` and `npm run lint` both pass
(the two remaining lint errors are pre-existing in `GrandPrixDetails.jsx`
and `NewsPage.jsx`, untouched by this redesign).

- **First visit:** open `/` in a fresh tab → intro car crosses once,
  page revealed left-to-right, hero visible under a transparent navbar.
- **Repeat visit, same session:** reload → no intro (sessionStorage). New
  tab/window → intro plays again.
- **Logged out:** invite panel slides in bottom-right after ~8 s;
  `PERSONALIZE MY FEED` → `/auth`; `MAYBE LATER` / × dismisses; reload →
  stays dismissed for the session. Radio greets “DRIVER”.
- **Logged in:** no invite. Radio shows your first name (“Box, box…”).
- **Favourites selected:** your driver/team rows highlighted in the timing
  board + championship (team-colour edge), `YOUR PICK` on the podium when
  they're on it, `FOR YOU` on matching news.
- **No preferences:** logged in without favourites → no highlights, nothing
  invented.
- **No live session:** Race Center shows NEXT SESSION + countdown + weekend
  schedule. **Live session:** during a scheduled window (or temporarily
  widen the windows in `landingHelpers.js` `SESSION_DEFS` to simulate) the
  header flips to a pulsing LIVE with the standings-order caption.
- **API loading:** brief mono “LOADING…” states; **API failure:** stop the
  server → honest UNAVAILABLE messages in Race Center, podium, news,
  standings; the page itself still renders.
- **Missing images:** podium falls back to monograms/plain portraits; circuit
  map falls back to the dashed blueprint; constructor cars simply absent;
  news frames hide broken images. (Helmet/car-asset probes produce expected,
  harmless 404s in the network tab — see ASSETS_REQUIRED.md.)
- **Desktop hover:** hero reveal follows the cursor; podium portraits reveal
  helmet layer where assets exist; explore tiles animate individually.
- **Mobile:** hero auto-sweeps; portrait tap swaps (with helmet assets);
  radio compact at bottom-right; invite becomes full-width; podium stacks
  P1→P2→P3; timing board drops the team column.
- **Keyboard:** Tab through navbar (Explore opens with Enter, closes with
  Escape), hero scroll cue, GP selector (arrows/Home/End/Enter/Escape),
  championship tabs (Arrow left/right), radio (Enter opens, Escape closes),
  every tile/link has a visible red focus ring.
- **Reduced motion:** enable “Reduce motion” in OS → intro is a brief fade,
  hero shows a static partial reveal, garage/footer content appears lit,
  pulses/bobs stop.
- **News navigation:** headlines open sources in new tabs;
  `VIEW ALL STORIES` → `/news`.
- **GP selection:** pick an earlier round → podium refetches once, then is
  cached; re-selecting the latest round uses the preloaded data.
- **Championship toggle:** DRIVERS/CONSTRUCTORS switch preserves scroll; car
  slot noses forward on row hover when assets exist.
- **Pit Wall Radio:** appears only after scrolling past the hero; expands to
  today's term (changes daily, stable within a day); `EXPLORE F1 DICTIONARY`
  → `/dictionary/<slug>`; hides while the footer is on screen.
- **Footer:** lights switch on once, rear light pulses once, car stays
  parked; links navigate; sign-in group reflects auth state.
- **Other pages:** navbar is the familiar light bar with the new structure;
  no landing styles leak.

---

## 10. Known limitations

1. **No live telemetry.** The project has no OpenF1 backend route, so the
   LIVE state is schedule-derived and the board shows championship order
   with an explicit on-screen label. Wiring OpenF1 later only requires
   feeding real rows into `TimingBoard` in `LiveRaceCenter.jsx`.
2. **Session windows are estimates** (60/45/180 min) used only to decide
   LIVE vs NEXT — official session lengths aren't in the Jolpica schedule.
3. **Helmet portraits, team car PNGs and the transparent hero/intro car**
   are user-supplied (ASSETS_REQUIRED.md); until then the designed fallbacks
   render. Only 9 drivers have local portraits — others get monograms.
4. **Weather** was deliberately omitted from the garage section: no reliable
   weather source exists in the project, and the brief forbids fake data.
5. **`API` base URL is hardcoded** to `http://localhost:3000` (consistent
   with the rest of the app) — centralising it in an env var is a good
   follow-up for the whole codebase.
6. **Pre-existing lint errors** in `GrandPrixDetails.jsx` / `NewsPage.jsx`
   and the pre-existing Vite chunk-size warning were left as-is (out of
   scope).
7. The old landing styles in `App.css` are now dead weight (see §3) —
   removable after you confirm no other page uses them.

