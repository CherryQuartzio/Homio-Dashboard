# Homio Dashboard - 100% Install & Go!

## Quick Start

Homio Dashboard is a **complete Home Assistant custom integration** - a clean, minimal, YAML-based dashboard built with tablets in mind. Install via HACS, add the integration, and it's **ready to use with ZERO configuration.yaml changes!**

## What's Included & Auto-Configured

This integration bundles EVERYTHING and configures it automatically:

- ✅ button-card v7.0.1 (auto-loaded)
- ✅ Modified layout-card with extra CSS properties (auto-loaded)
- ✅ my-slider-v2 for light brightness control (auto-loaded)
- ✅ All Homio icon assets (19 SVG files included)
- ✅ Dashboard templates and themes (auto-copied to `/config/themes/homio/`)
- ✅ Helper configurations (auto-copied to `/config/packages/homio/`)
- ✅ Template sensors (auto-created programmatically)
- ✅ Sidebar panel (auto-created)

**ZERO external dependencies! ZERO configuration.yaml changes! Everything is bundled and auto-configured!**

## Installation Steps

### 1. Install via HACS

- Go to HACS → Integrations
- Click "Custom repositories"
- Add this repository URL: `https://github.com/clutchthrower/Homio-Dashboard`
- Select category: **Integration**
- Search for "Homio Dashboard"
- Click "Download"
- **Restart Home Assistant**

### 2. Add the Integration

- Go to Settings → Devices & Services → Integrations
- Click "+ ADD INTEGRATION"
- Search for "Homio Dashboard"
- Click "Submit"
- **Restart Home Assistant again**

### 3. Select Homio Theme

- Click your profile (bottom left)
- Select "Homio" from the theme dropdown
- **The Homio icon (⭐+) is now in your sidebar!**

### 4. Add Your Room Images

Add your room background images to:
```
/config/homio/rooms/
```

Add `.jpg` files matching your room names (e.g., `lounge.jpg`, `bedroom.jpg`). These survive HACS updates.

### 5. Customize Your Dashboard

Use the Homio integration UI:

- **Configure** — logo name, which room the logo opens, nav order
- **Add room** — rooms, sensors, devices, and icon stems

Assets: `/config/homio/rooms/` (JPG stems) and `/config/homio/icons/` (SVG stems). Generated layout YAML under `/config/homio/layout/` is not hand-edited.

## Features

- **Auto-loaded Resources**: JavaScript dependencies load automatically, no manual resource configuration needed
- **Persistent assets**: Icons and room images live in `/config/homio/` (not wiped by HACS)
- **Bundled Icons**: 19 Google Material icons seeded into `/config/homio/icons/` on setup
- **Sidebar Integration**: Dashboard appears automatically in sidebar
- **Theme Included**: Homio theme bundled
- **Helpers Included**: All required input_boolean and input_number helpers

## Customization

- **Logo / nav order / rooms / devices**: Homio integration Configure + Add room (UI)
- **Additional Icons**: Add SVG files to `/config/homio/icons/`
- **Room Backgrounds**: Add JPG files to `/config/homio/rooms/`

## Support

For full documentation, examples, and support, visit the [GitHub repository](https://github.com/iamtherufus/Homio).
