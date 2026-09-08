"""Config flow for Homio Dashboard integration."""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    SOURCE_RECONFIGURE,
    SOURCE_USER,
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    ConfigSubentryFlow,
    OptionsFlow,
    SubentryFlowResult,
)
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_DEVICE_ENTITY,
    CONF_DEVICE_ICON,
    CONF_DEVICES,
    CONF_DISPLAY_NAME,
    CONF_HUMID_SENSOR,
    CONF_IMAGE,
    CONF_IMAGE_POSITION,
    CONF_LOGO_HOME_ROOM,
    CONF_LOGO_NAME,
    CONF_MOTION_SENSOR,
    CONF_NAV_NAME,
    CONF_NAV_ORDER,
    CONF_SHOW_HUMID,
    CONF_SHOW_IN_NAVIGATION,
    CONF_SHOW_MOTION,
    CONF_SHOW_TEMP,
    CONF_SLUG,
    CONF_TEMP_SENSOR,
    DEFAULT_IMAGE_POSITION,
    DEFAULT_LOGO_NAME,
    DOMAIN,
    SUBENTRY_TYPE_ROOM,
)
from .dashboard_generator import (
    icon_for_entity,
    merge_devices,
    room_slug,
    room_subentries,
)


def _room_select_options(entry: ConfigEntry, *, nav_only: bool = False) -> list[dict[str, str]]:
    """Build SelectSelector options from room subentries."""
    options: list[dict[str, str]] = []
    for sub in room_subentries(entry):
        data = sub.data
        slug = str(data.get(CONF_SLUG) or sub.unique_id or "")
        if not slug:
            continue
        if nav_only and not data.get(CONF_SHOW_IN_NAVIGATION, True):
            continue
        label = str(data.get(CONF_NAV_NAME) or sub.title or slug)
        options.append({"value": slug, "label": label})
    return options


class HomioConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Homio Dashboard."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(
                title="Homio Dashboard",
                data={},
                options={
                    CONF_LOGO_NAME: DEFAULT_LOGO_NAME,
                    CONF_LOGO_HOME_ROOM: "",
                    CONF_NAV_ORDER: [],
                },
            )

        return self.async_show_form(step_id="user")

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> HomioOptionsFlow:
        """Return the options flow handler."""
        return HomioOptionsFlow()

    @classmethod
    @callback
    def async_get_supported_subentry_types(
        cls, config_entry: ConfigEntry
    ) -> dict[str, type[ConfigSubentryFlow]]:
        """Return subentries supported by this integration."""
        return {SUBENTRY_TYPE_ROOM: RoomSubentryFlow}


class HomioOptionsFlow(OptionsFlow):
    """Global Homio options: logo, home room, nav order."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Manage Homio options."""
        entry = self.config_entry
        rooms = _room_select_options(entry)
        nav_rooms = _room_select_options(entry, nav_only=True)

        if user_input is not None:
            nav_order = user_input.get(CONF_NAV_ORDER) or []
            if isinstance(nav_order, str):
                nav_order = [nav_order]
            return self.async_create_entry(
                title="",
                data={
                    CONF_LOGO_NAME: user_input.get(CONF_LOGO_NAME) or DEFAULT_LOGO_NAME,
                    CONF_LOGO_HOME_ROOM: user_input.get(CONF_LOGO_HOME_ROOM) or "",
                    CONF_NAV_ORDER: list(nav_order),
                },
            )

        schema: dict[Any, Any] = {
            vol.Optional(
                CONF_LOGO_NAME,
                default=entry.options.get(CONF_LOGO_NAME, DEFAULT_LOGO_NAME),
            ): selector.TextSelector(),
        }
        if rooms:
            schema[
                vol.Optional(
                    CONF_LOGO_HOME_ROOM,
                    default=entry.options.get(CONF_LOGO_HOME_ROOM)
                    or rooms[0]["value"],
                )
            ] = selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=rooms, mode=selector.SelectSelectorMode.DROPDOWN
                )
            )
        if nav_rooms:
            current_order = [
                slug
                for slug in entry.options.get(CONF_NAV_ORDER, [])
                if any(o["value"] == slug for o in nav_rooms)
            ]
            if not current_order:
                current_order = [o["value"] for o in nav_rooms]
            schema[
                vol.Optional(CONF_NAV_ORDER, default=current_order)
            ] = selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=nav_rooms,
                    multiple=True,
                    reorder=True,
                    mode=selector.SelectSelectorMode.DROPDOWN,
                )
            )

        return self.async_show_form(step_id="init", data_schema=vol.Schema(schema))


class RoomSubentryFlow(ConfigSubentryFlow):
    """Add / reconfigure a Homio room."""

    def __init__(self) -> None:
        """Initialize scratch state for multi-step room flow."""
        self._room_input: dict[str, Any] = {}
        self._devices: list[dict[str, Any]] = []

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        """Start add-room flow."""
        return await self.async_step_room(user_input)

    async def async_step_reconfigure(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        """Start reconfigure-room flow."""
        return await self.async_step_room(user_input)

    def _existing_room_data(self) -> dict[str, Any]:
        if self.source != SOURCE_RECONFIGURE:
            return {}
        return dict(self._get_reconfigure_subentry().data)

    async def async_step_room(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        """Room details + device entity list."""
        existing = self._existing_room_data()
        errors: dict[str, str] = {}

        if user_input is not None:
            nav_name = str(user_input[CONF_NAV_NAME]).strip()
            if not nav_name:
                errors["base"] = "nav_name_required"
            else:
                slug = existing.get(CONF_SLUG) or room_slug(nav_name)
                # Unique slug on create.
                if self.source == SOURCE_USER:
                    entry = self._get_entry()
                    taken = {
                        str(s.data.get(CONF_SLUG) or s.unique_id)
                        for s in room_subentries(entry)
                    }
                    base = slug
                    n = 2
                    while slug in taken:
                        slug = f"{base}-{n}"
                        n += 1

                raw_devices = user_input.get(CONF_DEVICES) or []
                if isinstance(raw_devices, str):
                    raw_devices = [raw_devices]
                devices = merge_devices(
                    list(raw_devices),
                    existing.get(CONF_DEVICES),
                )

                self._room_input = {
                    CONF_NAV_NAME: nav_name,
                    CONF_SLUG: slug,
                    CONF_DISPLAY_NAME: (user_input.get(CONF_DISPLAY_NAME) or "").strip()
                    or None,
                    CONF_SHOW_IN_NAVIGATION: bool(
                        user_input.get(CONF_SHOW_IN_NAVIGATION, True)
                    ),
                    CONF_IMAGE: (user_input.get(CONF_IMAGE) or "").strip() or slug,
                    CONF_IMAGE_POSITION: DEFAULT_IMAGE_POSITION,
                    CONF_SHOW_TEMP: bool(user_input.get(CONF_SHOW_TEMP, False)),
                    CONF_TEMP_SENSOR: user_input.get(CONF_TEMP_SENSOR),
                    CONF_SHOW_HUMID: bool(user_input.get(CONF_SHOW_HUMID, False)),
                    CONF_HUMID_SENSOR: user_input.get(CONF_HUMID_SENSOR),
                    CONF_SHOW_MOTION: bool(user_input.get(CONF_SHOW_MOTION, False)),
                    CONF_MOTION_SENSOR: user_input.get(CONF_MOTION_SENSOR),
                }
                self._devices = devices
                if devices:
                    return await self.async_step_device_icons()
                return self._finish_room([])

        suggested = {
            CONF_NAV_NAME: existing.get(CONF_NAV_NAME, ""),
            CONF_DISPLAY_NAME: existing.get(CONF_DISPLAY_NAME) or "",
            CONF_SHOW_IN_NAVIGATION: existing.get(CONF_SHOW_IN_NAVIGATION, True),
            CONF_IMAGE: existing.get(CONF_IMAGE) or "",
            CONF_SHOW_TEMP: existing.get(CONF_SHOW_TEMP, False),
            CONF_TEMP_SENSOR: existing.get(CONF_TEMP_SENSOR),
            CONF_SHOW_HUMID: existing.get(CONF_SHOW_HUMID, False),
            CONF_HUMID_SENSOR: existing.get(CONF_HUMID_SENSOR),
            CONF_SHOW_MOTION: existing.get(CONF_SHOW_MOTION, False),
            CONF_MOTION_SENSOR: existing.get(CONF_MOTION_SENSOR),
            CONF_DEVICES: [
                d[CONF_DEVICE_ENTITY]
                for d in existing.get(CONF_DEVICES, [])
                if isinstance(d, dict) and d.get(CONF_DEVICE_ENTITY)
            ],
        }

        schema = vol.Schema(
            {
                vol.Required(CONF_NAV_NAME): selector.TextSelector(),
                vol.Optional(CONF_DISPLAY_NAME): selector.TextSelector(),
                vol.Optional(
                    CONF_SHOW_IN_NAVIGATION, default=True
                ): selector.BooleanSelector(),
                vol.Optional(CONF_IMAGE): selector.TextSelector(),
                vol.Optional(CONF_SHOW_TEMP, default=False): selector.BooleanSelector(),
                vol.Optional(CONF_TEMP_SENSOR): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain=["climate", "sensor"])
                ),
                vol.Optional(CONF_SHOW_HUMID, default=False): selector.BooleanSelector(),
                vol.Optional(CONF_HUMID_SENSOR): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain=["sensor"])
                ),
                vol.Optional(
                    CONF_SHOW_MOTION, default=False
                ): selector.BooleanSelector(),
                vol.Optional(CONF_MOTION_SENSOR): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain=["binary_sensor"])
                ),
                vol.Optional(CONF_DEVICES): selector.EntitySelector(
                    selector.EntitySelectorConfig(multiple=True, reorder=True)
                ),
            }
        )

        return self.async_show_form(
            step_id="room",
            data_schema=self.add_suggested_values_to_schema(schema, suggested),
            errors=errors,
        )

    async def async_step_device_icons(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        """Per-device Homio icon stems (TextSelector); auto-mapped on first add."""
        if user_input is not None:
            devices: list[dict[str, Any]] = []
            for device in self._devices:
                entity_id = device[CONF_DEVICE_ENTITY]
                if entity_id.startswith("climate."):
                    devices.append(
                        {CONF_DEVICE_ENTITY: entity_id, CONF_DEVICE_ICON: None}
                    )
                    continue
                raw = user_input.get(entity_id)
                if raw is None or str(raw).strip() == "":
                    icon = icon_for_entity(entity_id)
                else:
                    icon = str(raw).strip()
                devices.append({CONF_DEVICE_ENTITY: entity_id, CONF_DEVICE_ICON: icon})
            return self._finish_room(devices)

        schema_dict: dict[Any, Any] = {}
        suggested: dict[str, Any] = {}
        for device in self._devices:
            entity_id = device[CONF_DEVICE_ENTITY]
            if entity_id.startswith("climate."):
                continue
            schema_dict[vol.Optional(entity_id)] = selector.TextSelector()
            suggested[entity_id] = device.get(CONF_DEVICE_ICON) or icon_for_entity(
                entity_id
            )

        if not schema_dict:
            return self._finish_room(self._devices)

        return self.async_show_form(
            step_id="device_icons",
            data_schema=self.add_suggested_values_to_schema(
                vol.Schema(schema_dict), suggested
            ),
        )

    def _finish_room(self, devices: list[dict[str, Any]]) -> SubentryFlowResult:
        """Create or update the room subentry."""
        data = {**self._room_input, CONF_DEVICES: devices}
        title = str(data[CONF_NAV_NAME])
        slug = str(data[CONF_SLUG])
        entry = self._get_entry()

        if self.source == SOURCE_RECONFIGURE:
            return self.async_update_reload_and_abort(
                entry,
                self._get_reconfigure_subentry(),
                title=title,
                data=data,
                unique_id=slug,
            )

        return self.async_create_entry(title=title, data=data, unique_id=slug)
