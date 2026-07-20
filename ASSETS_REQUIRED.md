# ASSETS_REQUIRED.md — Landing Page Redesign

The redesigned landing page works **fully without any new assets** — every
visual has a built-in local fallback (SVG silhouette, monogram, blueprint
outline). Add the assets below whenever you find good ones and the page
upgrades itself. **No remote URLs are used anywhere on the landing page.**

---

## 1. Transparent F1 car side view (OPTIONAL — biggest visual upgrade)

| | |
|---|---|
| **Asset** | Side view of a modern F1 car, **nose pointing right**, transparent background |
| **Filename** | `car-side.png` |
| **Folder** | `client/public/images/` |
| **Dimensions** | ~1600 × 420 px (any similar wide ratio works; keep it sharp) |
| **Format** | PNG with real alpha transparency (no white box) |
| **Used by** | `client/src/components/landing/F1CarSilhouette.jsx` → which feeds the intro animation (`F1Intro.jsx`), the hero car layer, and the parked footer car (`GarageFooter.jsx`) |
| **Search terms** | `formula 1 car side view png transparent`, `F1 2026 car render side profile transparent`, `F1 livery side view cutout` |
| **Fallback until added** | A hand-drawn SVG silhouette with rotating wheels, red accent stripe and rear light (already looks intentional) |

**Activation step (one line):** after adding the file, open
`client/src/components/landing/F1CarSilhouette.jsx` and change

```js
export const CAR_IMAGE_SRC = null;
```
to
```js
export const CAR_IMAGE_SRC = "/images/car-side.png";
```

This is deliberate: keeping it `null` prevents a 404 request/console noise
while the file doesn't exist. If the image ever fails to load, the SVG
silhouette returns automatically.

> Note: the existing `client/public/images/ferrari.png` is a poster with a
> white background and embedded text/logos — it is **not** usable as a
> transparent car cutout.

---

## 2. Helmet / race-suit podium portraits (OPTIONAL — enables the podium hover reveal)

| | |
|---|---|
| **Asset** | For each existing driver portrait, a second image of the **same driver in helmet + race suit**, framed to align with the normal portrait (head/shoulders in the same position) |
| **Filenames** | Exactly the same file name as the normal portrait: `max.png`, `lewis.png`, `charles.png`, `george.png`, `kimi.png`, `lando.png`, `oscar.png`, `carlos.png`, `isaac.png` |
| **Folder** | `client/public/drivers/helmets/` (create this folder) |
| **Dimensions** | Same as the matching portrait in `client/public/drivers/` (portraits are displayed at 3 : 3.6 ratio, ~280 × 336 px on screen — 600 × 720 px source is plenty) |
| **Format** | PNG (transparency optional; images are shown inside a framed box) |
| **Used by** | `PodiumPortrait` inside `client/src/components/landing/PodiumSection.jsx` — desktop hover reveals the helmet image in a soft circle around the cursor; on touch, tapping the portrait swaps images |
| **Search terms** | `<driver name> helmet portrait 2026`, `<driver name> race suit press photo` |
| **Fallback until added** | The component probes the helmet path once (an expected, harmless 404 per podium driver); if missing, the portrait renders normally with a subtle rim-light hover and no broken imagery |

**Important:** the two images must be aligned (same crop/framing), otherwise
the cursor reveal looks like two unrelated photos.

Drivers without a local portrait at all (e.g. Alonso, Gasly) show a styled
initials monogram on the podium — adding a portrait to
`client/public/drivers/` fixes that independently of the helmet image.

---

## 3. Team car side views for the constructors table (OPTIONAL)

| | |
|---|---|
| **Asset** | Small side view of each team's current car, nose pointing right, transparent background |
| **Filenames** | `<constructorId>.png` using Jolpica constructor ids: `red_bull.png`, `ferrari.png`, `mercedes.png`, `mclaren.png`, `aston_martin.png`, `alpine.png`, `williams.png`, `haas.png`, `sauber.png`, `rb.png`, `audi.png`, `cadillac.png` (add whichever teams exist in the season you show) |
| **Folder** | `client/public/cars/` (create this folder) |
| **Dimensions** | ~600 × 160 px, transparent PNG (rendered at 30 px tall) |
| **Format** | PNG with alpha |
| **Used by** | `TeamCarImage` inside `client/src/components/landing/ChampionshipSection.jsx` — sits at the right edge of each constructor row and noses forward a few pixels on hover |
| **Search terms** | `F1 2026 <team> car side view png`, `<team> livery side profile transparent` |
| **Fallback until added** | The row renders without the car (one expected 404 probe per team while the constructors tab is open); nothing looks broken |

---

## 4. Assets that already exist and are reused (nothing to do)

- `client/public/circuits/<circuitId>/map.png` — circuit outline in the
  “Next on the Calendar” garage section (inverted to fit the dark theme).
  A dashed SVG blueprint is drawn if a map is missing.
- `client/public/drivers/*.png` — podium portraits.
- Team colours come from `client/src/data/teamInfo.js` (`teamColors.primary`).
- News imagery comes from the existing NewsAPI backend (external by nature);
  broken news images are hidden automatically.

## 5. Explicitly NOT required

- No fonts (uses the already-loaded Barlow / Barlow Condensed + system monospace).
- No video, no audio, no textures — garage/concrete/grid surfaces are pure CSS.
- No icon packs beyond the already-installed `lucide-react`.

---
---

# Part 2 — Entity Experience (The Grid · Pit Lane · Wheel to Wheel · Constructor Battle)

The redesigned Drivers, Driver Details, Teams, Team Details and both
comparison pages work **fully without any new assets** — every image slot
has a fallback chain, ending in a styled monogram/blueprint placeholder.

**How the drop-in pipeline works:** the components try a *canonical local
path first* (it may 404 today — that is expected and harmless), then the
image currently configured in `driverAssets.js` / `teamAssets.js` /
`data/*Info.js`, then a styled placeholder. So upgrading an image means
**placing one file in the right folder — no code changes**. Framing
(object-position / scale) and team accent colours are tuned centrally in:

- `client/src/config/driverAssets.js`
- `client/src/config/teamAssets.js`

## 6. Driver cut-outs (HIGH IMPACT — Driver Pass, dossier hero, Wheel to Wheel)

| | |
|---|---|
| **Asset** | Waist-up cut-out of each driver in race suit, facing camera or slightly angled, **transparent background** |
| **Filenames** | `<driverId>.webp` or `<driverId>.png` using Jolpica driver ids: `max_verstappen`, `leclerc`, `hamilton`, `russell`, `antonelli`, `norris`, `piastri`, `sainz`, `alonso`, `stroll`, `gasly`, `albon`, `ocon`, `bearman`, `hulkenberg`, `bortoleto`, `tsunoda`, `hadjar`, `lawson`, `colapinto`, `doohan`, `lindblad`, `bottas` … |
| **Folder** | `client/public/drivers/cutouts/` (create this folder) |
| **Dimensions** | ~800 × 1000 px (portrait), subject filling most of the height |
| **Format** | WebP or PNG with real alpha transparency (no white box) |
| **Used by** | Driver Pass (THE GRID carousel), Driver Details hero (shared-element transition), Wheel to Wheel hero |
| **Search terms** | `<driver name> 2026 render png transparent`, `<driver name> F1 driver cutout`, `<driver name> race suit png` |
| **Fallback until added** | The nine existing portraits in `client/public/drivers/` (mapped in `driverAssets.js`), then remote images from `data/driverInfo.js`, then an initials monogram |

## 7. Driver helmet renders (OPTIONAL — future hover/flip treatments)

| | |
|---|---|
| **Asset** | Side or 3/4 view of each driver's current helmet, transparent background |
| **Filenames** | Same `<driverId>.webp` / `<driverId>.png` convention |
| **Folder** | `client/public/drivers/helmets/` (shared with the landing page podium; both features read the same folder) |
| **Dimensions** | ~600 × 600 px |
| **Format** | WebP/PNG with alpha |
| **Used by** | Reserved slots in `driverAssets.js` (`helmetCandidates`) — wired for future reveal interactions, nothing breaks without them |
| **Search terms** | `<driver name> 2026 helmet png transparent` |

## 8. Team car side views (HIGH IMPACT — Garage Cards, Team Details hero, Constructor Battle)

| | |
|---|---|
| **Asset** | Full side view of each constructor's current car, **nose pointing right**, transparent background |
| **Filenames** | `<constructorId>.webp` or `<constructorId>.png`: `red_bull`, `ferrari`, `mercedes`, `mclaren`, `aston_martin`, `alpine`, `williams`, `haas`, `sauber`, `rb`, `audi`, `cadillac` |
| **Folder** | `client/public/teams/cars/` (create this folder) |
| **Dimensions** | ~1600 × 450 px, sharp, generous transparent padding trimmed |
| **Format** | WebP or PNG with alpha |
| **Used by** | Pit Lane Garage Card interiors (behind the shutter door), Team Details hero (shared-element transition), Constructor Battle facing cars |
| **Search terms** | `F1 2026 <team> car side view png transparent`, `<team> livery side profile render` |
| **Fallback until added** | The remote press photos referenced in `data/teamInfo.js` (shown inside a darkened garage frame), then a line-drawn blueprint car |

> Note: this folder (`client/public/teams/cars/`) is the canonical one for the
> entity pages. Section 3 above (`client/public/cars/`) belongs to the older
> landing-page constructors table; if you only source one set, place it here
> and update `ChampionshipSection.jsx` to read the same path.

## 9. Team accent colours (nothing to download)

Ambient garage lighting, pass hairlines and duel-meter colours come from
`TEAM_ACCENTS` in `client/src/config/driverAssets.js`. They are deliberately
desaturated to sit inside the site palette — adjust there if a team rebrands.

## 10. Explicitly NOT required for the entity pages

- No fonts, no textures, no video — carbon fibre, blueprints, shutter doors
  and start-line graphics are pure CSS.
- No new libraries — the coverflow carousel, count-up telemetry and
  shared-element page transitions (View Transitions API via React Router's
  `viewTransition`) are all dependency-free.

---
---

# Part 3 — Experience Pages (Race Weekend · Grand Prix HQ · From the Paddock · Pit Wall Briefing · My Garage · Join the Grid)

Like Parts 1 and 2, the redesigned experience pages work **fully without any
new assets** — every image slot has a styled fallback (dashed SVG blueprint,
halftone placeholder panel, monogram). Drop the files below into place and
each page upgrades itself with **no code changes**.

## 11. Circuit blueprint maps (HIGH IMPACT — Race Weekend + Grand Prix HQ)

| | |
|---|---|
| **Asset** | Clean top-down track outline per circuit (line art works best) |
| **Filenames** | `map.png` inside `client/public/circuits/<circuitId>/` using Jolpica circuit ids: `albert_park`, `shanghai`, `suzuka`, `bahrain`, `jeddah`, `miami`, `imola`, `monaco`, `catalunya`, `villeneuve`, `red_bull_ring`, `silverstone`, `spa`, `hungaroring`, `zandvoort`, `monza`, `baku`, `marina_bay`, `americas`, `rodriguez`, `interlagos`, `vegas`, `losail`, `yas_marina`, `madring` … |
| **Folder** | `client/public/circuits/<circuitId>/` (same folder the landing page already reads) |
| **Dimensions** | ~800 × 500 px, dark line art on light/transparent background |
| **Format** | PNG (the pages apply a CSS invert/hue filter so light-background maps sit correctly on the dark blueprint panels) |
| **Used by** | Race Weekend focus module + future-race hover reveals (`GrandPrix.jsx`), Grand Prix HQ hero (`GrandPrixDetails.jsx`), landing page garage |
| **Search terms** | `<circuit name> track map outline png`, `F1 <circuit> layout vector` |
| **Fallback until added** | A dashed SVG blueprint outline (already looks intentional) |

## 12. Race weekend hero photography (OPTIONAL — future upgrade)

| | |
|---|---|
| **Asset** | One wide atmospheric photo per circuit (grandstands, cityscape, key corner) to eventually sit behind the Race Weekend focus module and Grand Prix HQ hero |
| **Filenames** | `hero.jpg` inside `client/public/circuits/<circuitId>/` (a slot already referenced by `data/circuitInfo.js` → `image`) |
| **Dimensions** | ~1920 × 900 px, JPG, dark-friendly (the pages overlay a dark scrim) |
| **Used by** | Reserved — current implementation is pure CSS (carbon + blueprint), nothing breaks without these |
| **Search terms** | `<circuit name> grand prix wide shot`, `<circuit> aerial photo` |

## 13. News photography (nothing to do)

From the Paddock uses the article images delivered by the existing NewsAPI
backend (external by nature). Broken/missing images automatically fall back
to a styled halftone "FROM THE PADDOCK" panel — no local asset needed. If
you ever want a branded fallback, replace the CSS panel in
`client/src/pages/Paddock.css` (`.fp-img--missing`) with a local image.

## 14. Pit Wall Briefing diagrams (nothing to do)

The educational animations (DRS flap, tyre wear stages, marshal flags,
pit-stop wheel change, undercut/overcut strategy demo) are hand-drawn
SVG + CSS in `client/src/components/dictionary/TermAnimation.jsx` and
`client/src/pages/F1Dictionary.css`. No image assets required. To add an
animation for a new term, add a case to the slug map at the bottom of
`TermAnimation.jsx`.

## 15. My Garage / Join the Grid textures (nothing to do)

Garage lights, concrete floor, telemetry trace, carbon fibre, the starting
light gantry and the engineering rings are all pure CSS/SVG. Explicitly
**not** required: photos, videos, texture files.

## 16. Team accent colours (nothing to download)

- The constructor picker in Join the Grid (`client/src/pages/Authpage.jsx`,
  `TEAMS` array) carries its own official-team swatch colours — adjust there
  if a team rebrands.
- My Garage tints the constructor bay from `teamInfo` via
  `getTeamColor()` in `client/src/utils/landingHelpers.js`.

## 17. Explicitly NOT required for the experience pages

- No fonts (Barlow / Barlow Condensed already loaded + system monospace).
- No icon packs beyond the installed `lucide-react`.
- No new libraries — countdowns, scroll reveals, the shared-element story
  reader (View Transitions API) and the calendar → Grand Prix HQ page
  flight (React Router `viewTransition`) are all dependency-free.
