"""The Homio Dashboard integration."""
from __future__ import annotations

import logging
import shutil
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url, async_remove_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.components.lovelace import _register_panel
from homeassistant.components.lovelace.dashboard import LovelaceYAML
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN, STATIC_URL, USER_ASSETS_URL, VERSION
from .dashboard_generator import generate_dashboard, migrate_rooms_from_yaml, sections_path

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)

# Bundled icons live under www/; user copies go to /config/homio (survives HACS).
_BUNDLED_ICONS_REL = Path("images") / "Homio" / "icons"
_BUNDLED_ROOMS_REL = Path("images") / "Homio" / "rooms"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Homio Dashboard component."""
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Homio Dashboard from a config entry."""

    # Copy theme to standard themes directory for easy use
    await _copy_theme_to_config(hass)

    # Copy packages to standard packages directory
    await _copy_packages_to_config(hass)

    # Create template sensors (no YAML include needed!)
    await _create_template_sensors(hass)

    # Check if helper entities exist and warn if missing
    await _check_helper_entities(hass)

    # Persist user icons/rooms under /config/homio (survives HACS updates)
    await _prepare_user_assets(hass)

    # One-time migrate rooms from bundled/legacy YAML into subentries
    # (must run on the event loop — touches config_entries).
    migrate_rooms_from_yaml(hass, entry)
    entry = hass.config_entries.async_get_entry(entry.entry_id) or entry

    # Generate Lovelace YAML under /config/homio/layout from UI config
    await hass.async_add_executor_job(generate_dashboard, hass, entry)

    # Register static paths and resources
    await _register_static_resources(hass)

    # Register the dashboard panel (loads generated sections.yaml)
    await _setup_dashboard_panel(hass, entry)

    entry.async_on_unload(entry.add_update_listener(_async_reload_entry))

    return True


async def _async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload Homio when options or room subentries change."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    # Drop Lovelace dashboard object first, then remove the sidebar panel.
    # Leaving the panel registered causes Reload to fail with:
    # ValueError: Overwriting panel homio_dashboard owned by lovelace
    lovelace_data = hass.data.get("lovelace")
    if lovelace_data is not None:
        dashboards = getattr(lovelace_data, "dashboards", None)
        if dashboards is None and isinstance(lovelace_data, dict):
            dashboards = lovelace_data.get("dashboards")
        if isinstance(dashboards, dict):
            dashboards.pop(DOMAIN, None)

    async_remove_panel(hass, DOMAIN)
    return True


async def _copy_theme_to_config(hass: HomeAssistant) -> None:
    """Copy Homio theme to the standard Home Assistant themes directory."""
    integration_dir = Path(__file__).parent
    source_theme = integration_dir / "themes" / "homio"

    # Standard HA themes directory
    config_dir = Path(hass.config.config_dir)
    dest_themes_dir = config_dir / "themes"
    dest_theme = dest_themes_dir / "homio"

    def _copy_theme():
        """Copy theme files (runs in executor)."""
        try:
            # Create themes directory if it doesn't exist
            dest_themes_dir.mkdir(exist_ok=True)

            # Copy theme to standard location (overwrite if exists for updates)
            if source_theme.exists():
                if dest_theme.exists():
                    shutil.rmtree(dest_theme)
                shutil.copytree(source_theme, dest_theme)
                return True
            else:
                _LOGGER.warning(f"Source theme not found: {source_theme}")
                return False
        except Exception as e:
            _LOGGER.error(f"Failed to copy Homio theme: {e}")
            return False

    try:
        success = await hass.async_add_executor_job(_copy_theme)
        if success:
            _LOGGER.info(f"✅ Homio theme copied to {dest_theme}")
    except Exception as e:
        _LOGGER.error(f"Failed to copy Homio theme: {e}")


async def _copy_packages_to_config(hass: HomeAssistant) -> None:
    """Copy Homio packages to the standard Home Assistant packages directory."""
    integration_dir = Path(__file__).parent
    source_packages = integration_dir / "packages"

    # Standard HA packages directory
    config_dir = Path(hass.config.config_dir)
    dest_packages_dir = config_dir / "packages"
    dest_package = dest_packages_dir / "homio"

    def _copy_packages():
        """Copy package files (runs in executor)."""
        try:
            # Create packages directory if it doesn't exist
            dest_packages_dir.mkdir(exist_ok=True)

            # Copy packages to standard location (overwrite if exists for updates)
            if source_packages.exists():
                if dest_package.exists():
                    shutil.rmtree(dest_package)
                shutil.copytree(source_packages, dest_package)
                return True
            else:
                _LOGGER.warning(f"Source packages not found: {source_packages}")
                return False
        except Exception as e:
            _LOGGER.error(f"Failed to copy Homio packages: {e}")
            return False

    try:
        success = await hass.async_add_executor_job(_copy_packages)
        if success:
            _LOGGER.info(f"✅ Homio packages copied to {dest_package}")
    except Exception as e:
        _LOGGER.error(f"Failed to copy Homio packages: {e}")


async def _create_template_sensors(hass: HomeAssistant) -> None:
    """Create Homio template sensors programmatically (no YAML needed!)."""
    try:
        # Create Current Date sensor
        hass.states.async_set(
            "sensor.homio_current_date",
            "",
            {
                "friendly_name": "Current Date",
                "icon": "mdi:calendar",
            }
        )

        # Create Current Time sensor
        hass.states.async_set(
            "sensor.homio_current_time",
            "",
            {
                "friendly_name": "Current Time",
                "icon": "mdi:clock",
            }
        )

        # Set up periodic updates
        async def update_sensors(now=None):
            """Update the template sensors."""
            from datetime import datetime
            now = datetime.now()

            # Format date: "Monday 29th December 2025"
            day = now.day
            suffix = "th" if 11 <= day <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
            date_str = now.strftime(f"%A {day}{suffix} %B %Y")

            # Format time: "14:30"
            time_str = now.strftime("%H:%M")

            hass.states.async_set("sensor.homio_current_date", date_str)
            hass.states.async_set("sensor.homio_current_time", time_str)

        # Update immediately
        await update_sensors()

        # Update every minute
        from homeassistant.helpers.event import async_track_time_interval
        from datetime import timedelta
        async_track_time_interval(hass, update_sensors, timedelta(minutes=1))

        _LOGGER.info("✅ Homio template sensors created (sensor.homio_current_date, sensor.homio_current_time)")

    except Exception as e:
        _LOGGER.error(f"Failed to create Homio sensors: {e}")


async def _check_helper_entities(hass: HomeAssistant) -> None:
    """Check if helper entities exist and provide helpful warnings."""
    required_helpers = [
        "input_boolean.homio_mobile_navigation",
        "input_boolean.homio_heating_control",
        "input_boolean.homio_hot_water_control",
        "input_number.homio_thermostat_target_temperature",
    ]

    missing_helpers = []
    for entity_id in required_helpers:
        if entity_id not in hass.states.async_entity_ids():
            missing_helpers.append(entity_id)

    if missing_helpers:
        _LOGGER.warning(
            "⚠️  Missing helper entities: %s\n"
            "These helpers are needed for dashboard functionality.\n"
            "Add to your configuration.yaml:\n"
            "homeassistant:\n"
            "  packages: !include_dir_named packages\n"
            "Then restart Home Assistant.",
            ", ".join(missing_helpers)
        )
    else:
        _LOGGER.info("✅ All required helper entities found")


def _copy_if_missing(src: Path, dest: Path) -> bool:
    """Copy src to dest only when dest does not already exist."""
    if not src.is_file() or dest.exists():
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    return True


def _copy_dir_files_if_missing(src_dir: Path, dest_dir: Path, pattern: str) -> int:
    """Copy matching files from src_dir into dest_dir without overwriting."""
    if not src_dir.is_dir():
        return 0
    copied = 0
    dest_dir.mkdir(parents=True, exist_ok=True)
    for src in src_dir.glob(pattern):
        if _copy_if_missing(src, dest_dir / src.name):
            copied += 1
    return copied


async def _prepare_user_assets(hass: HomeAssistant) -> Path:
    """Ensure /config/homio/{icons,rooms} exists; seed bundled icons; migrate old www assets."""
    integration_dir = Path(__file__).parent
    www_dir = integration_dir / "www"
    data_dir = Path(hass.config.path("homio"))
    icons_dir = data_dir / "icons"
    rooms_dir = data_dir / "rooms"
    bundled_icons = www_dir / _BUNDLED_ICONS_REL
    bundled_rooms = www_dir / _BUNDLED_ROOMS_REL

    def _prepare() -> tuple[int, int]:
        icons_dir.mkdir(parents=True, exist_ok=True)
        rooms_dir.mkdir(parents=True, exist_ok=True)
        # Copy-if-missing from integration www: seeds bundled SVGs and migrates
        # any user files still left under the old HACS-wiped path.
        icon_count = _copy_dir_files_if_missing(bundled_icons, icons_dir, "*.svg")
        room_count = _copy_dir_files_if_missing(bundled_rooms, rooms_dir, "*.jpg")
        return icon_count, room_count

    try:
        icon_count, room_count = await hass.async_add_executor_job(_prepare)
        _LOGGER.info(
            "Homio user assets ready at %s (copied %s icons, %s room JPGs if missing)",
            data_dir,
            icon_count,
            room_count,
        )
    except Exception as err:
        _LOGGER.error("Failed to prepare Homio user assets at %s: %s", data_dir, err)

    return data_dir


async def _register_static_resources(hass: HomeAssistant) -> None:
    """Register static paths and frontend resources."""
    integration_dir = Path(__file__).parent
    www_dir = integration_dir / "www"
    data_dir = Path(hass.config.path("homio"))

    # Panel SPA stays at /homio_dashboard (url_path=DOMAIN).
    # Bundled JS must use a different first path segment (/homiofiles) so a
    # hard refresh of /homio_dashboard/living reaches IndexView instead of
    # StaticResource 404. Icons/rooms stay on /homio_assets.
    try:
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(STATIC_URL, str(www_dir), cache_headers=False),
                StaticPathConfig(USER_ASSETS_URL, str(data_dir), cache_headers=False),
            ]
        )
        _LOGGER.info("Registered static path: %s -> %s", STATIC_URL, www_dir)
        _LOGGER.info("Registered static path: %s -> %s", USER_ASSETS_URL, data_dir)
    except RuntimeError:
        _LOGGER.debug("Homio static paths already registered")

    # JavaScript files loaded globally via add_extra_js_url (classic script tags).
    # - layout-card-modified: IIFE — also register as Lovelace type `js`.
    # - homio-*.js: IIFEs for Fixed + YAML panels (or inline Lovelace resources).
    # Do NOT add here:
    # - community/light-slider/my-slider-v2.js (ES module — Lovelace resource type `module` only)
    # - button-card/button-card.js (dual-load with HACS button-card breaks cards)
    js_files = [
        "community/layout-card-modified/layout-card-modified.js",
        "homio-menu-nav.js",
        "homio-header-fit.js",
        "homio-entity-strip.js",
        "homio-room-text-fit.js",
        "homio-nested-ripple-kill.js",
        "homio-scroll-lock.js",
        "homio-theme-fix.js",
    ]

    # Register each JavaScript file as a frontend resource
    for file_path in js_files:
        full_path = www_dir / file_path
        if full_path.exists():
            # Add to frontend resources with version for cache busting
            resource_url = f"{STATIC_URL}/{file_path}?v={VERSION}"
            add_extra_js_url(hass, resource_url, es5=False)
            _LOGGER.info(f"Registered JS resource: {resource_url}")
        else:
            _LOGGER.warning(f"JS file not found: {full_path}")


async def _setup_dashboard_panel(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Register the Homio Dashboard panel."""

    dashboard_path = sections_path(hass)

    dashboard_config = {
        "mode": "yaml",
        "title": "Homio",
        "icon": "mdi:star-plus-outline",
        "show_in_sidebar": True,
        "filename": str(dashboard_path),
        "require_admin": False,
    }

    # Get lovelace data
    lovelace_data = hass.data.get("lovelace")
    if not lovelace_data:
        _LOGGER.error("Lovelace data not available")
        return

    # Create the Lovelace YAML dashboard
    dashboard = LovelaceYAML(hass, DOMAIN, dashboard_config)

    # Use attribute access instead of dictionary access
    if hasattr(lovelace_data, "dashboards"):
        lovelace_data.dashboards[DOMAIN] = dashboard
    else:
        # Fallback for older HA versions
        lovelace_data["dashboards"][DOMAIN] = dashboard

    # Load the dashboard YAML config (this is critical for proper routing!)
    try:
        await dashboard.async_load(False)
        _LOGGER.info("Dashboard YAML loaded successfully")
    except Exception as e:
        _LOGGER.error(f"Failed to load dashboard YAML: {e}")
        raise

    # Register the panel in the frontend sidebar (this makes the icon show up!)
    # update=True allows Reload when unload could not clear the panel (or race).
    try:
        _register_panel(hass, DOMAIN, "yaml", dashboard_config, False)
    except ValueError:
        _LOGGER.debug("Homio panel already registered; updating in place")
        _register_panel(hass, DOMAIN, "yaml", dashboard_config, True)

    _LOGGER.info("Homio Dashboard panel registered successfully")
