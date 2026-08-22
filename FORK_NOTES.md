# Homio Fixed / fork notes (CherryQuartzio)

This tree is based on [clutchthrower/Homio-Dashboard](https://github.com/clutchthrower/Homio-Dashboard)
with portable fixes discovered while building the storage dashboard **Homio Fixed**
(`url_path=homio-fixed`) on Home Assistant (~2026.8.3).

Local clone: `E:\repo\Homio-Dashboard`  
Branch: `port/homio-fixed-fixes`  
Remotes: `origin` → `https://github.com/CherryQuartzio/Homio-Dashboard.git`,  
`upstream` → `https://github.com/clutchthrower/Homio-Dashboard.git`

## Status

- **Daily driver on HA:** Homio Fixed (`url_path=homio-fixed`). Stock YAML panel `/homio_dashboard` stayed historically broken — do not switch HACS to this fork until you validate the YAML panel end-to-end.
- **GitHub fork:** https://github.com/CherryQuartzio/Homio-Dashboard (isFork of clutchthrower).
- **Latest live snapshot:** `examples/homio-fixed/` — `config_hash=f12bfa33f415d5a3`.

## Changelog (session work ported here)

### Lovelace resources (live HA)

| Resource | Correct type | Notes |
|----------|--------------|--------|
| HACS button-card | `module` | Do **not** dual-load Homio’s bundled button-card |
| layout-card-modified | `js` (IIFE) | Homio path `/homio_dashboard/community/layout-card-modified/...` |
| **my-slider-v2** | **`module`** (ES `export`) | Was wrongly `js` → Firefox/Edge `SyntaxError` on every load. Bump `?v=` when changing. |
| kiosk-mode | `module` | `kiosk_mode.hide_header: true` on views |
| Google Fonts Hanken Grotesk | `css` | Required for theme font family |
| `homio-scroll-lock.js` | `module` (or inline) | Lightweight CSS clamp only — no full shadow walks / 500ms polls |
| `homio-theme-fix.js` | `module` (or inline) | Path-scoped to `/homio-fixed` + `/homio_dashboard` |

### Chromium room backgrounds

- CSS gradient color-stops **must** have a space after `rgba(...)` (e.g. `rgba(...) 0%`). Chromium rejects `)0%` and drops the whole `background`.
- Only `lounge.jpg` existed under `/homio_dashboard/images/Homio/rooms/` on this install — dining/kitchen/office/bedroom 404’d. Upload matching JPGs or point rooms at an existing file.
- Firefox was more forgiving; Chromium showed missing backgrounds.

### Thermostat / temperature

- Prefer `climate.*` `current_temperature` (°C) over a companion °F temperature sensor for the room temp line.
- `homio_thermostat`: off / cool / heat mode buttons; state text for heat, cool, heat_cool; portable `entity.entity_id` (no hardcoded climate id).
- Helper `input_number.homio_thermostat_target_temperature` range **10–32** (°C).

### Lights

- `homio_light` restored to Homio’s dimmable card: tap on when off, hold off when on, `custom:my-slider-v2` when on. Requires my-slider-v2 as **module**.

### Room / UX

- Views: `theme: homio`, `kiosk_mode.hide_header: true`.
- Edit with header hidden: append `?disable_km` to the URL.
- Ripple kill on full-viewport `homio_room`; keep local ripples on entity/nav cards.
- Nav label can differ from room title (e.g. nav **Master**, title “Master Bedroom”).
- Brand/logo text is site-editable (live may show “Daylor”).

### Theme (`themes/homio/homio.yaml`)

- Incomplete vs modern HA: add `sans-serif` fallback for `primary-font-family`, set `ha-card-border-width: 0px` and transparent border color (HA 2022.11+ otherwise draws 1px square borders).
- Companion: `www/homio-theme-fix.js` for path-scoped font/border overrides when the profile theme is not Homio.

## Diff vs upstream (portable files)

| Area | Change |
|------|--------|
| `homio_room.yaml` | Null sensor defaults; climate-aware temp; spaced gradient stops; `100dvh`; ripple kill; desktop hide `#mobile_logo` |
| `homio_light.yaml` | Full my-slider-v2 dimmable card |
| `homio_thermostat.yaml` | Cool mode + heat/cool/off state_display |
| `homio_navigation.yaml` | Outer `custom:layout-card` (not nested `vertical-stack`) |
| `homio_screen_layout.yaml` / `homio_entity_layout.yaml` | Viewport overflow clamps |
| `homio_nav_button.yaml` / `homio_time.yaml` | Safer templates; nowrap labels |
| `packages/homio_helpers.yaml` | Thermostat helper 10–32 °C |
| `themes/homio/homio.yaml` | Font fallback + border width |
| `www/homio-scroll-lock.js` | Lightweight path-scoped overflow clamp |
| `www/homio-theme-fix.js` | Path-scoped Homio font/border fix |
| `examples/homio-fixed/` | Live dashboard snapshot + meta |

## Site-specific snapshot

`examples/homio-fixed/dashboard.json` — full Homio Fixed Lovelace config. Reference / re-import only; entity ids and paths are for this HA.

## Do not reintroduce

- Room/view `height: 100%` alone → layout collapse  
- Clamp `#navigation` height → hides desktop heading  
- Nested `vertical-stack` inside button-card → broken  
- Dual-load Homio + HACS button-card  
- **`my-slider-v2` as type `js`** → SyntaxError  
- Unspaced gradient stops `)0%` → Chromium drops background  
- python_transform: no `def`, no `set.add`, no `next()` — use list comps  

## Helpers

`input_boolean.homio_mobile_navigation`, heating/hot-water controls,  
`input_number.homio_thermostat_target_temperature` (10–32).  
Sensors: `sensor.homio_current_time`, `sensor.homio_current_date`.
