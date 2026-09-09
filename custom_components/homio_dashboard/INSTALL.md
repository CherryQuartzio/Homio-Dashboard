# Homio Dashboard Installation

This integration is installed via HACS and includes ALL dependencies!

## Installation Steps

### 1. Install via HACS

1. Go to HACS → Integrations
2. Click "Custom repositories"
3. Add this repository URL: `https://github.com/clutchthrower/Homio-Dashboard`
4. Select category: **Integration**
5. Search for "Homio Dashboard"
6. Click "Download"
7. **Restart Home Assistant**

### 2. Configure Packages (ONE LINE!)

Add this ONE line to your `configuration.yaml`:

```yaml
homeassistant:
  packages: !include_dir_named packages
```

This loads the helper entities (input_boolean, input_number) needed for navigation and controls.

**Save and restart Home Assistant**

### 3. Add the Integration

1. Go to Settings → Devices & Services → Integrations
2. Click "+ ADD INTEGRATION"
3. Search for "Homio Dashboard"
4. Click "Submit"
5. **Restart Home Assistant again**

**That's it!** The integration automatically configures everything:

- ✅ **JavaScript dependencies** (button-card, layout-card-modified, my-slider-v2) - auto-loaded
- ✅ **Homio theme** - auto-copied to `/config/themes/homio/`
- ✅ **Helper packages** - auto-copied to `/config/packages/homio/` and loaded via packages config
- ✅ **Template sensors** (sensor.homio_current_date, sensor.homio_current_time) - auto-created
- ✅ **Sidebar panel** - auto-registered with icon (⭐+)

**Only ONE configuration.yaml line needed!**

### 3. Select Homio Theme

1. Click your profile (bottom left)
2. Select "Homio" from the theme dropdown

### 4. Add Room Images

Add your room background images to:
```
/config/homio/rooms/
```

For example: `/config/homio/rooms/lounge.jpg`

Bundled icons are seeded into `/config/homio/icons/` on setup and served at `/homio_assets/icons/`. Add custom SVGs there as well (they survive HACS updates).

### 8. Access the Dashboard

Click the Homio icon (⭐+) in your sidebar to access your dashboard!

## Customization

Configure Homio from the integration UI (no hand-editing of Lovelace YAML):

1. **Settings → Devices & Services → Homio → Configure** — logo name, logo home room, navigation order, clock format / AM/PM / tap action
2. **Add room** / configure each room — nav name, display name, background stem, sensors, devices
3. Device icon stems (second step) map to `/config/homio/icons/{stem}.svg` (auto-filled on first add)

Room backgrounds go in `/config/homio/rooms/{stem}.jpg`. Generated dashboard files live under `/config/homio/layout/` and are overwritten on reload — do not edit them by hand.

A fresh install shows a **Welcome** dashboard view that points at Configure / Add room. Existing user YAML at `/config/homio/homio.yaml` or `/config/dashboards/homio/homio.yaml` is still migrated once on first setup. The bundled Daylor sample under `lovelace/homio.yaml` is reference only and is not auto-imported.

## Support

For issues, visit: https://github.com/iamtherufus/Homio
