# Homio Fixed / fork notes (CherryQuartzio)

This tree is based on [clutchthrower/Homio-Dashboard](https://github.com/clutchthrower/Homio-Dashboard)
with portable fixes discovered while building the storage dashboard **Homio Fixed**
(`url_path=homio-fixed`) on Home Assistant.

Local clone: `E:\repo\Homio-Dashboard`  
Branch: `port/homio-fixed-fixes`  
Remotes: `origin` → `https://github.com/CherryQuartzio/Homio-Dashboard.git`,  
`upstream` → `https://github.com/clutchthrower/Homio-Dashboard.git`

## Status

- **Daily driver on HA:** keep using Homio Fixed. Do not switch HACS to this fork until
  you are ready to validate the YAML panel end-to-end.
- **GitHub fork:** the MCP GitHub token could not create the remote fork/repo (403).
  Create `CherryQuartzio/Homio-Dashboard` (empty) then `git push -u origin port/homio-fixed-fixes`
  (and push `main` if desired), or run `gh repo fork clutchthrower/Homio-Dashboard` after
  `gh auth login`.

## Diff vs upstream (portable)

| Area | Change |
|------|--------|
| `homio_room.yaml` | Sensor defaults `null` (fixes ButtonCardJSTemplateError from literal `variables.*` strings); guarded `states[...]`; °F/°C temp labels; hide mobile logo on desktop; `100dvh` + `max-height` + no bottom padding; `entities` custom_field styles; `triggers_update: all` |
| `homio_navigation.yaml` | Outer `custom:layout-card` instead of `vertical-stack` (button-card cannot create built-in stacks) |
| `homio_screen_layout.yaml` | `100dvh`, `overflow: hidden`, `max-height: 100dvh` |
| `homio_entity_layout.yaml` | Explicit `overflow: hidden` |
| `homio_nav_button.yaml` / `homio_time.yaml` | Safer path/time templates; nowrap nav labels |
| `lovelace/homio.yaml` | Nested entities under room; null sensors; optional `kiosk_mode.hide_header` |
| `www/homio-scroll-lock.js` | Overflow clamp for `/homio-fixed` and `/homio_dashboard`; `window.__homioOverflowReport()` |

## Site-specific snapshot

`examples/homio-fixed/dashboard.json` — full Homio Fixed Lovelace config (rooms, entities,
`/homio-fixed/...` paths, kiosk_mode). Reference only until you re-import or reinstall.

## Lovelace resources required on HA

1. HACS **button-card** (module) — do **not** dual-load Homio’s bundled button-card  
2. Homio **layout-card-modified** — `/homio_dashboard/community/layout-card-modified/layout-card-modified.js` type **js**  
3. Homio **my-slider-v2** — `/homio_dashboard/community/light-slider/my-slider-v2.js` type **js**  
4. HACS **kiosk-mode** (module) — for `kiosk_mode.hide_header`  
5. Scroll lock — register `/homio_dashboard/homio-scroll-lock.js` as type **module**  
   (or keep the existing inline resource on Homio Fixed)

Do **not** also install stock HACS layout-card alongside Homio’s modified build.

## Do not reintroduce

- `#navigation` fixed height / `height: 0` (hides desktop heading)  
- Room/view `height: 100%` alone (collapses layout to a thin strip)  
- Sibling entity strip under the view (inflates scroll height) — nest under room `custom_fields.entities`  
- Dual-loading Homio button-card + HACS button-card  

## Helpers

UI helpers (not packages): `input_boolean.homio_mobile_navigation`, heating/hot-water controls,
`input_number.homio_thermostat_target_temperature`. Sensors: `sensor.homio_current_time`,
`sensor.homio_current_date`.
