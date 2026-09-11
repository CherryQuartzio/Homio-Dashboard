/** Homio brand-logo overlay — isolated from the rest of the dashboard.
 *
 * SAFE: light-DOM text overlay only. Never reparents Lit nodes.
 * NEVER sets opacity/animation on room, entity, nav, or clock cards.
 * Only reads geometry from cards that are clearly the brand logo
 * (template homio_logo / homio_mobile_logo, or #mobile_logo slot).
 */
(() => {
  const PATH_RE = /^\/(homio-fixed|homio_dashboard)(\/|$)/;
  const HOLD_ID = "homio-logo-hold";
  const STYLE_ID = "homio-logo-hold-style";
  const LOGO_ATTR = "data-homio-brand-logo";
  let hold = null;
  let syncTimer = 0;
  let observer = null;
  let active = false;
  let repaired = false;
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
      "}" +
      /* Only brand-logo hit-targets we mark — never other dashboard cards. */
      "button-card[" +
      LOGO_ATTR +
      "]{" +
      "opacity:0!important;animation:none!important;transition:none!important;" +
      "}";
    document.documentElement.appendChild(style);
  }

  /** Undo damage from older persist builds that zeroed arbitrary button-cards. */
  function repairNonLogoCards() {
    document.querySelectorAll("button-card").forEach((card) => {
      if (card.hasAttribute(LOGO_ATTR)) return;
      try {
        card.style.removeProperty("opacity");
        card.style.removeProperty("animation");
        card.style.removeProperty("transition");
        const root = card.shadowRoot;
        if (!root) return;
        ["ha-card", ".button-card-main"].forEach((sel) => {
          const el = root.querySelector(sel);
          if (!el || !el.style) return;
          el.style.removeProperty("opacity");
          el.style.removeProperty("animation");
          el.style.removeProperty("transition");
        });
      } catch (e) {
        /* ignore */
      }
    });
  }

  function cardTemplates(card) {
    const cfg = card.config || card._config || {};
    const t = cfg.template;
    if (Array.isArray(t)) return t.map(String);
    if (t != null) return [String(t)];
    return [];
  }

  function isBrandLogoTemplate(card) {
    const templates = cardTemplates(card);
    return (
      templates.indexOf("homio_logo") !== -1 ||
      templates.indexOf("homio_mobile_logo") !== -1
    );
  }

  function deepButtonCards(node, out) {
    if (!node) return;
    if (node.localName === "button-card") out.push(node);
    const root = node.shadowRoot;
    if (root) {
      root.querySelectorAll("button-card").forEach((c) => out.push(c));
      root.querySelectorAll("*").forEach((el) => {
        if (el.shadowRoot) deepButtonCards(el, out);
      });
    }
    if (node.querySelectorAll) {
      node.querySelectorAll("button-card").forEach((c) => out.push(c));
    }
  }

  /** Logo slots only: #mobile_logo and brand templates under #navigation. */
  function findBrandLogoCard() {
    const candidates = [];
    document.querySelectorAll("button-card").forEach((room) => {
      const sr = room.shadowRoot;
      if (!sr) return;
      const mobile = sr.getElementById("mobile_logo");
      if (mobile) {
        const list = [];
        deepButtonCards(mobile, list);
        list.forEach((c) => candidates.push(c));
      }
      const nav = sr.getElementById("navigation");
      if (nav) {
        const list = [];
        deepButtonCards(nav, list);
        list.forEach((c) => {
          if (isBrandLogoTemplate(c)) candidates.push(c);
        });
      }
    });

    // Fallback: any card that still exposes the brand logo template.
    if (!candidates.length) {
      document.querySelectorAll("button-card").forEach((c) => {
        if (isBrandLogoTemplate(c)) candidates.push(c);
      });
    }

    let best = null;
    let bestScore = -1;
    const seen = new Set();
    for (let i = 0; i < candidates.length; i++) {
      const card = candidates[i];
      if (seen.has(card)) continue;
      seen.add(card);
      const root = card.shadowRoot;
      if (!root) continue;
      const name = root.querySelector("#name");
      if (!name) continue;
      const text = (name.textContent || "").trim();
      if (!text) continue;
      const rect = card.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      // Brand logo is a small header chip, never a room/entity card.
      if (rect.height > 40 || rect.width > window.innerWidth * 0.4) continue;
      let score = 0;
      if (isBrandLogoTemplate(card)) score += 10;
      if (rect.top >= 40 && rect.top <= 100) score += 3;
      if (rect.left < window.innerWidth * 0.35) score += 2;
      if (score > bestScore) {
        bestScore = score;
        best = { card, name, text, rect };
      }
    }
    return best;
  }

  function markLogoOnly(card) {
    if (!card) return;
    card.setAttribute(LOGO_ATTR, "1");
    // Keep hit-target; do not touch any other cards.
    const root = card.shadowRoot;
    if (!root) return;
    const ha = root.querySelector("ha-card");
    if (ha) {
      ha.style.setProperty("opacity", "0", "important");
      ha.style.setProperty("animation", "none", "important");
      ha.style.setProperty("transition", "none", "important");
    }
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
    const width = Math.max(Math.ceil(rect.width), 8);
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
  }

  function syncFromLive() {
    if (!active) return;
    if (!repaired) {
      repairNonLogoCards();
      repaired = true;
    }
    ensureHold();
    const logo = findBrandLogoCard();
    if (!logo) return;
    markLogoOnly(logo.card);
    paintHold(logo);
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = 0;
      syncFromLive();
    }, 48);
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
    repaired = false;
    repairNonLogoCards();
    repaired = true;
    if (active) {
      scheduleSync();
      return;
    }
    active = true;
    armObserver();
    syncFromLive();
    requestAnimationFrame(() => syncFromLive());
    setTimeout(syncFromLive, 120);
    setTimeout(syncFromLive, 400);
  }

  function deactivate() {
    active = false;
    repaired = false;
    clearTimeout(syncTimer);
    syncTimer = 0;
    clearObserver();
    document.querySelectorAll("button-card[" + LOGO_ATTR + "]").forEach((c) => {
      c.removeAttribute(LOGO_ATTR);
    });
    repairNonLogoCards();
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onLocation);
  } else {
    onLocation();
  }
})();
