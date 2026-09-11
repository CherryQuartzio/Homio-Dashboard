/** Keep the Homio logo painted across room view swaps.
 *
 * SAFE: light-DOM text overlay only — never reparent Lit/Lovelace nodes.
 *
 * Live logo cards are opacity:0 hit-targets (no homio_default fadeIn). This
 * overlay is the only painted logo and stays mounted for the whole Homio
 * session so room remounts cannot fade it.
 */
(() => {
  const PATH_RE = /^\/(homio-fixed|homio_dashboard)(\/|$)/;
  const HOLD_ID = "homio-logo-hold";
  const STYLE_ID = "homio-logo-hold-style";
  let hold = null;
  let syncTimer = 0;
  let observer = null;
  let active = false;
  let lastPaint = { text: "", left: 0, top: 0, width: 0, height: 0 };

  function onHomioPath(path) {
    return PATH_RE.test(path || location.pathname || "");
  }

  function ensureGlobalStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      "#" +
      HOLD_ID +
      "{" +
      "position:fixed;z-index:10000;pointer-events:none;margin:0;padding:0;" +
      "white-space:nowrap;line-height:1;display:flex;align-items:center;" +
      "opacity:1!important;visibility:visible!important;" +
      "transition:none!important;animation:none!important;" +
      "}";
    document.documentElement.appendChild(style);
  }

  function isLogoName(text) {
    if (!text) return false;
    const t = text.trim();
    if (!t || t.length > 24) return false;
    if (/[°%]/.test(t) || /^\d/.test(t)) return false;
    if (/^\d{1,2}:\d{2}/.test(t)) return false;
    return /^[A-Za-z][A-Za-z0-9 .'-]{0,22}\.?$/.test(t);
  }

  function suppressCard(card) {
    if (!card || !card.style) return;
    card.style.setProperty("opacity", "0", "important");
    card.style.setProperty("animation", "none", "important");
    card.style.setProperty("transition", "none", "important");
    const root = card.shadowRoot;
    if (!root) return;
    const ha = root.querySelector("ha-card");
    if (ha) {
      ha.style.setProperty("opacity", "0", "important");
      ha.style.setProperty("animation", "none", "important");
      ha.style.setProperty("transition", "none", "important");
    }
    const main = root.querySelector(".button-card-main");
    if (main) {
      main.style.setProperty("opacity", "0", "important");
      main.style.setProperty("animation", "none", "important");
      main.style.setProperty("transition", "none", "important");
    }
  }

  function findLogoCard() {
    const cards = document.querySelectorAll("button-card");
    let best = null;
    let bestScore = -1;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const root = card.shadowRoot;
      if (!root) continue;
      const name = root.querySelector("#name");
      if (!name) continue;
      const text = (name.textContent || "").trim();
      if (!isLogoName(text)) continue;
      const rect = card.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      let score = 0;
      if (rect.top >= 40 && rect.top <= 100) score += 5;
      if (rect.height <= 40) score += 3;
      if (rect.left < window.innerWidth * 0.4) score += 2;
      if (/homio|home|daylor/i.test(text)) score += 4;
      if (rect.height > 50 || rect.width > window.innerWidth * 0.55) continue;
      suppressCard(card);
      if (score > bestScore) {
        bestScore = score;
        best = { card, name, text, rect };
      }
    }
    return best;
  }

  function ensureHold() {
    ensureGlobalStyle();
    if (hold && hold.isConnected) return hold;
    let el = document.getElementById(HOLD_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = HOLD_ID;
      el.setAttribute("aria-hidden", "true");
      document.body.appendChild(el);
    }
    hold = el;
    return hold;
  }

  function paintHold(logo) {
    const el = ensureHold();
    const { name, text, rect } = logo;
    const cs = window.getComputedStyle(name);
    const left = rect.left;
    const top = rect.top;
    const height = Math.max(rect.height, 22);
    const width = Math.ceil(rect.width);
    // Avoid rewriting DOM text every mutation (can flicker).
    if (lastPaint.text !== text) {
      el.textContent = text;
      lastPaint.text = text;
    }
    el.style.color = cs.color || "#fff";
    el.style.fontFamily = cs.fontFamily || "inherit";
    el.style.fontSize = cs.fontSize || "18px";
    el.style.fontWeight = cs.fontWeight || "700";
    el.style.letterSpacing = cs.letterSpacing || "2px";
    el.style.textTransform = cs.textTransform || "uppercase";
    if (
      Math.abs(lastPaint.left - left) > 0.5 ||
      Math.abs(lastPaint.top - top) > 0.5 ||
      Math.abs(lastPaint.width - width) > 0.5 ||
      Math.abs(lastPaint.height - height) > 0.5
    ) {
      el.style.left = left + "px";
      el.style.top = top + "px";
      el.style.height = height + "px";
      el.style.width = width + "px";
      lastPaint.left = left;
      lastPaint.top = top;
      lastPaint.width = width;
      lastPaint.height = height;
    }
    el.style.opacity = "1";
    el.style.visibility = "visible";
  }

  function syncFromLive() {
    if (!active) return;
    ensureHold();
    const logo = findLogoCard();
    if (!logo) return;
    paintHold(logo);
  }

  function scheduleSync() {
    // Suppress logos immediately; debounce geometry sync only.
    findLogoCard();
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = 0;
      syncFromLive();
    }, 32);
  }

  function clearObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function armObserver() {
    clearObserver();
    observer = new MutationObserver(() => scheduleSync());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function activate() {
    ensureGlobalStyle();
    ensureHold();
    if (active) {
      scheduleSync();
      return;
    }
    active = true;
    armObserver();
    syncFromLive();
    requestAnimationFrame(() => {
      syncFromLive();
      requestAnimationFrame(syncFromLive);
    });
    setTimeout(syncFromLive, 100);
    setTimeout(syncFromLive, 300);
  }

  function deactivate() {
    active = false;
    clearTimeout(syncTimer);
    syncTimer = 0;
    clearObserver();
    if (hold) {
      try {
        hold.remove();
      } catch (e) {
        /* ignore */
      }
    }
    hold = null;
    lastPaint = { text: "", left: 0, top: 0, width: 0, height: 0 };
  }

  function onLocation() {
    if (onHomioPath()) activate();
    else deactivate();
  }

  // Paint/hold BEFORE the view tears down on Homio→Homio navigation.
  document.addEventListener(
    "click",
    (ev) => {
      if (!onHomioPath() || !active) return;
      const path = typeof ev.composedPath === "function" ? ev.composedPath() : [];
      for (let i = 0; i < path.length; i++) {
        const n = path[i];
        if (!n || n.nodeType !== 1 || n.tagName !== "BUTTON-CARD") continue;
        const cfg = n.config || n._config;
        const tap = cfg && cfg.tap_action;
        const nav =
          (tap &&
            tap.action === "navigate" &&
            typeof tap.navigation_path === "string" &&
            tap.navigation_path) ||
          (cfg &&
            cfg.variables &&
            typeof cfg.variables.path === "string" &&
            cfg.variables.path);
        if (nav && onHomioPath(nav)) {
          syncFromLive();
          return;
        }
      }
    },
    true
  );

  window.addEventListener("location-changed", onLocation);
  window.addEventListener("popstate", onLocation);
  window.addEventListener("resize", () => {
    if (active) scheduleSync();
  });
  window.addEventListener(
    "scroll",
    () => {
      if (active) scheduleSync();
    },
    true
  );

  const push = history.pushState.bind(history);
  history.pushState = (...args) => {
    if (active) syncFromLive();
    push(...args);
    onLocation();
  };
  const replace = history.replaceState.bind(history);
  history.replaceState = (...args) => {
    replace(...args);
    onLocation();
  };

  if (typeof ResizeObserver === "function") {
    new ResizeObserver(() => {
      if (active) scheduleSync();
    }).observe(document.documentElement);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onLocation);
  } else {
    onLocation();
  }
})();
