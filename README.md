<img width="128" alt="icon" src="https://github.com/user-attachments/assets/90efb1db-7330-420a-aea1-4fe1abb2a96f" />

# Homio

Homio is a clean, minimal Home Assistant dashboard designed for wall tablets, with a layout that also works well on phones. Each room is a full-bleed background with a simple navigation bar and a row of entity cards.

This repository packages Homio as a Home Assistant integration so rooms, logo, navigation, and devices are easily configured in the UI — no hand-edited Lovelace YAML.

**Design credit:** Homio was created by [Rufus (iamtherufus)](https://github.com/iamtherufus). The original dashboard lives at [iamtherufus/Homio](https://github.com/iamtherufus/Homio).

### Desktop / tablet

<img width="1512" alt="Homio desktop view" src="https://github.com/user-attachments/assets/0c904899-f970-4fbe-9e13-64b069ffc126" />
<img width="1511" alt="Homio desktop view with entities" src="https://github.com/user-attachments/assets/36b5c8b3-1943-4d3b-9e3f-a066236cfec3" />
<img width="1483" alt="Homio room overview" src="https://github.com/user-attachments/assets/b2780ae6-e3f0-4ac8-a7c7-5f5c82e8b3d1" />

### Mobile

<img width="572" alt="Homio mobile view" src="https://github.com/user-attachments/assets/3be316dd-c7a2-4592-979e-6147084c3cc0" />
<img width="572" alt="Homio mobile drawer" src="https://github.com/user-attachments/assets/5718134e-4ca3-4247-adf0-8a170d70cc6b" />

## Installation

1. In **HACS → Integrations**, open **Custom repositories** and add:
   - URL: `https://github.com/CherryQuartzio/Homio-Dashboard`
   - Category: **Integration**
2. Download **Homio Dashboard**, then **restart Home Assistant**.
3. Go to **Settings → Devices & Services → Add integration**, search for **Homio Dashboard**, and submit.
4. If you do not already load packages, add this to `configuration.yaml`, then restart once more:

   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```

5. In your profile, select the **Homio** theme.
6. Open the Homio item in the sidebar. A fresh install shows a Welcome page that points at the integration UI.

## Customization

Configure Homio from **Settings → Devices & Services → Homio** (no Lovelace YAML editing):

| Action | What it does |
|--------|----------------|
| **Configure** | Logo text, which room the logo opens, navigation order, clock format / AM/PM / tap action |
| **Add room** | Room name, background stem, optional temp / humidity / motion sensors, and devices |

### Room backgrounds

Put JPG files in `/config/homio/rooms/`. The filename stem must match the **image** stem set on the room (for example `lounge.jpg` for stem `lounge`).

### Icons

Bundled SVG icons are seeded into `/config/homio/icons/` on setup. Add your own SVGs there as well. When you add devices to a room, pick an icon stem (for example `lamp`) so Homio loads `/homio_assets/icons/lamp.svg`.

Extra Material icons: [Google Fonts Icons](https://fonts.google.com/icons). For matching icons, use Material Symbols Style with weight set to 100, grade at 200, and 48px optical size.

Both folders survive HACS updates.

## Entity cards

Homio picks a card from the device domain when you add entities in **Add room**. These templates ship with the integration:

### Room

Full-width room banner: background image, room name, and optional temperature, humidity, and motion.

<img width="1482" alt="Homio room card" src="https://github.com/user-attachments/assets/e0a7dacf-6e47-4f03-96c4-c9cee3ec2bc9" />

### Light

On/off and brightness with a slider. Used for `light` entities.

<img width="262" alt="Homio light card" src="https://github.com/user-attachments/assets/b47d8a7f-7c14-4960-9e0b-2e3f1fe78ed1" />

### Thermostat

HVAC mode and target temperature. Used for `climate` entities.

<img width="260" alt="Homio thermostat card" src="https://github.com/user-attachments/assets/323bff09-3bbb-405a-ba4a-28c23c6c4021" />
<img width="260" alt="Homio thermostat controls" src="https://github.com/user-attachments/assets/39a8330b-ef0e-423a-8d72-a21e482c8a57" />

### Entity

Generic status card for other domains (sensors, binary sensors, media players, switches, and similar). Uses the icon stem you set for the device.
