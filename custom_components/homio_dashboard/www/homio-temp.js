/** Homio temperature helpers for button-card templates.
 *
 * Climate attributes stay in entity.temperature_unit; sensors usually already
 * match the HA unit system. Always convert to hass.config.unit_system.temperature
 * for Homio display.
 */
(() => {
  function isFahrenheit(unit) {
    return String(unit || "").toUpperCase().indexOf("F") !== -1;
  }

  function displayUnit(hass) {
    const u =
      hass &&
      hass.config &&
      hass.config.unit_system &&
      hass.config.unit_system.temperature;
    return u || "°C";
  }

  function convert(value, fromUnit, toUnit) {
    const n = typeof value === "number" ? value : parseFloat(value);
    if (value == null || Number.isNaN(n)) return NaN;
    if (isFahrenheit(fromUnit) === isFahrenheit(toUnit)) return n;
    return isFahrenheit(toUnit) ? (n * 9) / 5 + 32 : ((n - 32) * 5) / 9;
  }

  function format(value, digits) {
    const n = typeof value === "number" ? value : parseFloat(value);
    if (Number.isNaN(n)) return "";
    const d = digits == null ? 1 : digits;
    return n.toFixed(d);
  }

  /** Climate attribute value → HA preferred unit. */
  function fromClimate(hass, entity, attrName) {
    if (!entity || !entity.attributes) return { value: NaN, unit: displayUnit(hass) };
    const unitOut = displayUnit(hass);
    const unitIn = entity.attributes.temperature_unit || unitOut;
    const raw = entity.attributes[attrName];
    return { value: convert(raw, unitIn, unitOut), unit: unitOut };
  }

  /** Sensor state → HA preferred unit (no-op when already converted). */
  function fromSensor(hass, stateObj) {
    const unitOut = displayUnit(hass);
    if (!stateObj) return { value: NaN, unit: unitOut };
    const unitIn =
      (stateObj.attributes && stateObj.attributes.unit_of_measurement) || unitOut;
    return { value: convert(stateObj.state, unitIn, unitOut), unit: unitOut };
  }

  /** Helper buffer is always °C (packages/homio_helpers.yaml). */
  function fromHelperC(hass, celsiusValue) {
    const unitOut = displayUnit(hass);
    return { value: convert(celsiusValue, "°C", unitOut), unit: unitOut };
  }

  /** Convert helper °C buffer into a climate entity's temperature_unit. */
  function helperCToClimate(entity, celsiusValue) {
    const unitOut =
      (entity && entity.attributes && entity.attributes.temperature_unit) || "°C";
    return convert(celsiusValue, "°C", unitOut);
  }

  function comfortLabel(value, unit) {
    const n = typeof value === "number" ? value : parseFloat(value);
    if (Number.isNaN(n)) return "";
    if (isFahrenheit(unit)) {
      if (n <= 60) return "Very Cold";
      if (n <= 67) return "Cool";
      if (n <= 74) return "Comfortable";
      return "Very Hot";
    }
    if (n <= 15.99) return "Very Cold";
    if (n <= 17.99) return "Cool";
    if (n <= 20.99) return "Comfortable";
    return "Very Hot";
  }

  window.homioTemp = {
    displayUnit,
    convert,
    format,
    fromClimate,
    fromSensor,
    fromHelperC,
    helperCToClimate,
    comfortLabel,
    isFahrenheit,
  };
})();
