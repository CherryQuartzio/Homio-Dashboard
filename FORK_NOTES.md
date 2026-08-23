# Homio Fixed / fork notes (CherryQuartzio)

This tree is based on [clutchthrower/Homio-Dashboard](https://github.com/clutchthrower/Homio-Dashboard)
with portable fixes discovered while building the storage dashboard **Homio Fixed**
(`url_path=homio-fixed`) on Home Assistant (~2026.8.3).

Local clone: `E:\repo\Homio-Dashboard`  
Branch: `port/homio-fixed-fixes`  
Remotes: `origin` → `https://github.com/CherryQuartzio/Homio-Dashboard.git`,  
`upstream` → `https://github.com/clutchthrower/Homio-Dashboard.git`

Integration version: **1.0.2** (`const.VERSION` — bump when changing registered JS or YAML panel).

## Status

- **Daily driver on HA:** Homio Fixed (`url_path=homio-fixed`). Keep it until the YAML Homio panel matches Fixed end-to-end (Phase 4).
- **GitHub fork:** https://github.com/CherryQuartzio/Homio-Dashboard (isFork of clutchthrower).
- **HACS install:** `CherryQuartzio/Homio-Dashboard` **`v1.0.2-homio-yaml`** (Phase 3). Config entry `01M0KTC6V0X5NKDP7M5Z99NSYZ` state **loaded**.
- **Latest live Fixed snapshot:** `examples/homio-fixed/` — `config_hash=b8556503e641f00f` (exported 2026-08-23 Phase 1; Fixed left untouched in Phase 3).
- **Phase 1 HA backups:** snapshot `edf057f9` (`Before_Homio_Fork_Swap_Phase1`); edits backup `dashboard.homio-fixed.20260823_111154.yaml`. See `examples/homio-fixed/resources.json`.
- **After Phase 2:** room JPGs under `www/images/Homio/rooms/` were wiped by the HACS folder replace (404). Restore from snapshot `edf057f9` or re-upload into `custom_components/homio_dashboard/www/images/Homio/rooms/`.
- **Phase 3 (YAML parity):** `lovelace/homio.yaml` has the five Daylor rooms (living / dining / kitchen / office / master-bedroom) with Fixed entity IDs; nav + logo defaults point at `/homio_dashboard/...`. Templates remain `!include`s.

## Changelog (session work ported here)

### Mobile menu (per-browser)

- Open state is **not** `input_boolean.homio_mobile_navigation` (that syncs every client).
- Resource / file: `www/homio-menu-nav.js` — sets CSS vars (`--homio-menu-panel-display`, burger/close display, etc.).
- Burger **28×23**, X **22×22**, host top **57.5px** (centers on DAYLOR 18px @ 60px).
- Templates: `homio_menu_icon.yaml`, `homio_room.yaml` (`#mobile_menu_icon` absolute + `extra_styles`).
- Drawer: `homio_navigation.yaml` — `inset: 0`, **no** mid-list `height: 100%`, `place-content: space-between`, padding `60px 8vw calc(60px + env(safe-area-inset-bottom)) 8vw`.

### Lovelace resources (live HA)

| Resource | Correct type | Notes |
|----------|--------------|--------|
| HACS button-card | `module` | Do **not** dual-load Homio’s bundled button-card |
| layout-card-modified | `js` (IIFE) | `/homio_dashboard/community/layout-card-modified/...` — allowlists `place-*`, `inset`, `overflow*`, etc. |
| **my-slider-v2** | **`module`** (ES `export`) | Was wrongly `js` → Firefox/Edge `SyntaxError`. Bump `?v=` when changing. |
| kiosk-mode | `module` | `kiosk_mode.hide_header: true` on views |
| Google Fonts Hanken Grotesk | `css` | Required for theme font family |
| `homio-menu-nav.js` | `module` (or inline) | Per-browser menu; path-scoped |
| `homio-entity-strip.js` | `module` (or inline) | Pan-vs-tap, chrome-drag, sticky hover clear |
| `homio-header-fit.js` | `module` (or inline) | Per-browser compact header CSS vars |
| `homio-room-text-fit.js` | `module` (or inline) | Lift room text when colliding with entity strip |
| `homio-nested-ripple-kill.js` | `module` (or inline) | Kill nested chrome ripples (touch) |
| `homio-scroll-lock.js` | `module` (or inline) | Lightweight CSS clamp — no full shadow walks |
| `homio-theme-fix.js` | `module` (or inline) | Path-scoped to `/homio-fixed` + `/homio_dashboard` |

`__init__.py` registers the Homio helper scripts (and bundled cards) via `add_extra_js_url` with `?v={VERSION}`. Fresh installs still need HACS button-card as `module` if not using Homio’s bundled copy alone.

### Clock

- `homio_time` prefers `sensor.homio_current_time_2`, falls back to `sensor.homio_current_time`.
- Durable `_2` helper is created in HA UI (or package); integration still maintains ephemeral `sensor.homio_current_time`.

### Chromium room backgrounds

- CSS gradient color-stops **must** have a space after `rgba(...)` (e.g. `rgba(...) 0%`). Chromium rejects `)0%` and drops the whole `background`.
- Upload matching room JPGs under `www/images/Homio/rooms/` or point rooms at an existing file.

### Thermostat / temperature

- Prefer `climate.*` `current_temperature` (°C) over a companion °F temperature sensor for the room temp line.
- `homio_thermostat`: off / cool / heat mode buttons; portable `entity.entity_id`.
- Helper `input_number.homio_thermostat_target_temperature` range **10–32** (°C).

### Lights

- `homio_light` dimmable card: tap on when off, hold off when on, `custom:my-slider-v2` when on. Requires my-slider-v2 as **module**.

### Room / UX

- Views: `theme: homio`, `kiosk_mode.hide_header: true`.
- Edit with header hidden: append `?disable_km` to the URL.
- Transparent `--ha-card-background` on nav / time / logo / menu icon (no dark theme boxes).
- Brand/logo text is site-editable (live may show “Daylor”).

### Theme (`themes/homio/homio.yaml`)

- Add `sans-serif` fallback for `primary-font-family`, set `ha-card-border-width: 0px` and transparent border color.

## Diff vs upstream (portable files)

| Area | Change |
|------|--------|
| `homio_room.yaml` | Null sensors; climate temp; spaced gradients; menu overlays; per-browser menu |
| `homio_menu_icon.yaml` | 28×23 / 22×22; fire-dom-event menu toggle; CSS display vars |
| `homio_navigation.yaml` | Drawer layout for Fixed (space-between, no mid height) |
| `homio_entity.yaml` / entity layout | Strip sizing, white ripple, menu display var |
| `homio_light.yaml` / `homio_thermostat.yaml` | Dimmable + cool/heat portable |
| `homio_*_logo` / `homio_nav_button` / `homio_time` | Transparent cards; clock `_2` |
| `packages/homio_helpers.yaml` | Helpers; menu boolean kept only for old dashboards |
| `layout-card-modified.js` | Extra CSS allowlist for drawer |
| `www/homio-*.js` | Menu, strip, header/room fit, ripple kill, scroll, theme |
| `www/images/Homio/icons/menu.svg` | Integer-snapped burger |
| `examples/homio-fixed/` | Live dashboard + resources inventory |

## Site-specific snapshot

`examples/homio-fixed/dashboard.json` — full Homio Fixed Lovelace config. Reference / re-import only; entity ids and paths are for this HA.

`examples/homio-fixed/resources.json` — resource ids + Phase 1 backup ids.

## Do not reintroduce

- Room/view `height: 100%` alone → layout collapse  
- Mid drawer list `height: 100%` → clock clips / scroll  
- Nested `vertical-stack` inside button-card → broken  
- Dual-load Homio + HACS button-card  
- **`my-slider-v2` as type `js`** → SyntaxError  
- Unspaced gradient stops `)0%` → Chromium drops background  
- Shared `input_boolean` for menu open state → syncs every browser  
- button-card custom_fields styles as bare strings when dict siblings work — prefer dicts + `extra_styles !important` for overlays  
- python_transform: no `def`, no `set.add`, no `next()` — use list comps  

## Helpers

`input_boolean.homio_mobile_navigation` (legacy only), heating/hot-water controls,  
`input_number.homio_thermostat_target_temperature` (10–32).  
Sensors: `sensor.homio_current_time`, `sensor.homio_current_time_2`, `sensor.homio_current_date`.

## Phase 3 — YAML panel Daylor rooms

- `lovelace/homio.yaml`: five views matching Homio Fixed (`living`, `dining`, `kitchen`, `office`, `master-bedroom`) with site entity IDs; screen/entity layouts via `!include`.
- `homio_navigation_list.yaml` + logo/nav fallbacks: `/homio_dashboard/<room>` (not placeholders / not `/homio-fixed`).
- Homio Fixed storage dashboard left untouched; cutover remains Phase 4.
- Release tag: **`v1.0.2-homio-yaml`** (integration **1.0.2**).
