"""Constants for the Homio Dashboard integration."""

DOMAIN = "homio_dashboard"
VERSION = "1.0.6"

# Bundled JS/community modules. Must NOT share the panel url_path prefix
# (/homio_dashboard) — a StaticPathConfig there steals hard-refresh GETs
# like /homio_dashboard/living and returns 404.
STATIC_URL = "/homiofiles"

# Persistent user assets (icons + room JPGs) under /config/homio, served here.
USER_ASSETS_URL = "/homio_assets"
