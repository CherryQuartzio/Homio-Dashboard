/** Homio header cleanup — no logo hide / no overlay.
 *
 * Earlier builds hid the live logo (opacity:0) and painted a light-DOM clone.
 * That frequently failed to find nested logo cards and also left room title /
 * entity cards stuck invisible. Nav never needed that trick — it stays still
 * with animation:none alone. Logo templates now do the same.
 *
 * This file only heals leftover damage and removes obsolete overlay nodes.
 * It never sets opacity on room, entity, nav, clock, or logo cards.
 */
(() => {
  const PATH_RE = /^\/(homio-fixed|homio_dashboard)(\/|$)/;
  const HOLD_ID = "homio-logo-hold";
  const STYLE_ID = "homio-logo-hold-style";
  const LOGO_ATTR = "data-homio-brand-logo";
  let done = false;

  function onHomioPath(path) {
    return PATH_RE.test(path || location.pathname || "");
  }

  function walkShadow(node, visit) {
    if (!node) return;
    visit(node);
    if (node.shadowRoot) {
      node.shadowRoot.querySelectorAll("*").forEach((el) => walkShadow(el, visit));
    }
  }

  function allButtonCards() {
    const out = [];
    const seen = new Set();
    const collect = (node) => {
      if (!node || node.localName !== "button-card" || seen.has(node)) return;
      seen.add(node);
      out.push(node);
    };
    document.querySelectorAll("button-card").forEach(collect);
    document.querySelectorAll("*").forEach((el) => walkShadow(el, collect));
    return out;
  }

  function clearInlineOpacity(el) {
    if (!el || !el.style) return;
    el.style.removeProperty("opacity");
    el.style.removeProperty("animation");
    el.style.removeProperty("transition");
    el.style.removeProperty("visibility");
  }

  /** Remove obsolete overlay + CSS var from older persist builds. */
  function removeObsoleteOverlay() {
    document.documentElement.style.removeProperty("--homio-logo-live-opacity");
    const hold = document.getElementById(HOLD_ID);
    if (hold) {
      try {
        hold.remove();
      } catch (e) {
        /* ignore */
      }
    }
    const style = document.getElementById(STYLE_ID);
    if (style) {
      try {
        style.remove();
      } catch (e) {
        /* ignore */
      }
    }
  }

  /** Undo opacity damage from prior persist builds; never hide anything. */
  function repairVisibility() {
    removeObsoleteOverlay();
    allButtonCards().forEach((card) => {
      try {
        card.removeAttribute(LOGO_ATTR);
        clearInlineOpacity(card);
        const root = card.shadowRoot;
        if (!root) return;
        ["ha-card", ".button-card-main", "#name", "#temperature", "#humidity"].forEach(
          (sel) => {
            const el = root.querySelector(sel);
            clearInlineOpacity(el);
          }
        );
        ["#entities", "#navigation", "#mobile_logo"].forEach((sel) => {
          const el = root.querySelector(sel);
          clearInlineOpacity(el);
        });
      } catch (e) {
        /* ignore */
      }
    });
  }

  function run() {
    if (!onHomioPath()) return;
    repairVisibility();
    if (!done) {
      done = true;
      // Catch late Lit renders after view swap / HACS refresh.
      setTimeout(repairVisibility, 120);
      setTimeout(repairVisibility, 400);
      setTimeout(repairVisibility, 1200);
    }
  }

  function onLocation() {
    done = false;
    run();
  }

  window.addEventListener("location-changed", onLocation);
  window.addEventListener("popstate", onLocation);
  window.addEventListener("pageshow", onLocation);

  const push = history.pushState.bind(history);
  history.pushState = (...args) => {
    push(...args);
    onLocation();
  };
  const replace = history.replaceState.bind(history);
  history.replaceState = (...args) => {
    replace(...args);
    onLocation();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onLocation);
  } else {
    onLocation();
  }
})();
