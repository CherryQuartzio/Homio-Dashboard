"""Constants for the Homio Dashboard integration."""

DOMAIN = "homio_dashboard"
VERSION = "1.0.22"

# Bundled JS/community modules. Must NOT share the panel url_path prefix
# (/homio_dashboard) — a StaticPathConfig there steals hard-refresh GETs
# like /homio_dashboard/living and returns 404.
STATIC_URL = "/homiofiles"

# Persistent user assets (icons + room JPGs) under /config/homio, served here.
USER_ASSETS_URL = "/homio_assets"

# User layout dir under hass.config.path("homio").
USER_HOMIO_DIR = "homio"
USER_LAYOUT_DIR = "layout"
USER_SECTIONS_FILE = "sections.yaml"
USER_NAVIGATION_FILE = "navigation.yaml"
USER_GENERATED_DIR = "_generated"

# Config entry options / room subentry keys.
CONF_LOGO_NAME = "logo_name"
CONF_LOGO_HOME_ROOM = "logo_home_room"
CONF_NAV_ORDER = "nav_order"

CONF_CLOCK_FORMAT = "clock_format"
CONF_CLOCK_SHOW_AM_PM = "clock_show_am_pm"
CONF_CLOCK_TAP_ACTION = "clock_tap_action"
CONF_CLOCK_NAVIGATION_PATH = "clock_navigation_path"
CONF_CLOCK_URL = "clock_url"
CONF_CLOCK_MORE_INFO_ENTITY = "clock_more_info_entity"

CLOCK_FORMAT_12 = "12"
CLOCK_FORMAT_24 = "24"
CLOCK_TAP_NONE = "none"
CLOCK_TAP_NAVIGATE = "navigate"
CLOCK_TAP_URL = "url"
CLOCK_TAP_MORE_INFO = "more-info"

DEFAULT_LOGO_NAME = "HOMIO."
DEFAULT_IMAGE_POSITION = "center center"
DEFAULT_CLOCK_FORMAT = CLOCK_FORMAT_24
DEFAULT_CLOCK_SHOW_AM_PM = True
DEFAULT_CLOCK_TAP_ACTION = CLOCK_TAP_NONE

CONF_NAV_NAME = "nav_name"
CONF_SLUG = "slug"
CONF_DISPLAY_NAME = "display_name"
CONF_SHOW_IN_NAVIGATION = "show_in_navigation"
CONF_IMAGE = "image"
CONF_IMAGE_POSITION = "image_position"
CONF_SHOW_TEMP = "show_temp"
CONF_TEMP_SENSOR = "temp_sensor"
CONF_SHOW_HUMID = "show_humid"
CONF_HUMID_SENSOR = "humid_sensor"
CONF_SHOW_MOTION = "show_motion"
CONF_MOTION_SENSOR = "motion_sensor"
CONF_DEVICES = "devices"
CONF_DEVICE_ENTITY = "entity"
CONF_DEVICE_ICON = "icon"
# Optional card label override; None/blank → HA friendly name at generate time.
CONF_DEVICE_NAME = "name"

SUBENTRY_TYPE_ROOM = "room"

# Homio SVG stems under /homio_assets/icons/{stem}.svg
DOMAIN_ICON_MAP: dict[str, str | None] = {
    "climate": None,
    "light": "light",
    "cover": "shades",
    "fan": "fan",
    "media_player": "google_tv",
    "switch": "plug",
    "binary_sensor": "door",
    "sensor": "plug",
    "lock": "door",
    "vacuum": "plug",
    "humidifier": "dehumidifier",
}
DEFAULT_DEVICE_ICON = "plug"

# One-time YAML→subentry migration gate (entry.data).
CONF_YAML_MIGRATED = "yaml_migrated"
