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
