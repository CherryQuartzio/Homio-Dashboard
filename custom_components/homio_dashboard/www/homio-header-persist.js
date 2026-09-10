/** Keep the Homio logo painted across room view swaps.
 *
 * SAFE: paints a light-DOM text clone only. Never reparents Lit/Lovelace nodes
 * (that approach in 1.0.12 crashed the panel).
 */
(() => {
  const PATH_RE = /^\/(homio-fixed|homio_dashboard)(\/|$)/;
  const HOLD_ID = "homio-logo-hold";
  const MAX_HOLD_MS = 2500;
  let hold = null;
  let releaseTimer = 0;
  let observer = null;

  function onHomioPath(path) {
    return PATH_RE.test(path || location.pathname || "");
  }

  function isLogoName(text) {
    if (!text) return false;
    const t = text.trim();
    if (!t || t.length > 24) return false;
    if (/[°%]/.test(t) || /^\d/.test(t)) return false;
    if (/^\d{1,2}:\d{2}/.test(t)) return false;
    // Brand word (HOMIO / HOME / DAYLOR / custom), optional trailing period.
    return /^[A-Za-z][A-Za-z0-9 .'-]{0,22}\.?$/.test(t);
  }

  function findLogoCard() {
    const cards = document.querySelectorAll("button-card");
    let best = null;
    let bestScore = -1;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (hold && hold.contains(card)) continue;
      const root = card.shadowRoot;
      if (!root) continue;
      const name = root.querySelector("#name");
      if (!name) continue;
      const text = (name.textContent || "").trim();
      if (!isLogoName(text)) continue;
      const rect = card.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      // Prefer cards that look like the header logo (top band, not room title).
      let score = 0;
      if (rect.top >= 40 && rect.top <= 90) score += 5;
      if (rect.height <= 40) score += 3;
      if (rect.left < window.innerWidth * 0.35) score += 2;
      if (/homio|home|daylor/i.test(text)) score += 4;
      // Skip huge room titles.
      if (rect.height > 50 || rect.width > window.innerWidth * 0.55) continue;
      if (score > bestScore) {
        bestScore = score;
        best = { card, name, text, rect };
      }
    }
    return best;
  }

  function clearObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function releaseHold() {
    clearTimeout(releaseTimer);
    releaseTimer = 0;
    clearObserver();
    if (hold) {
      try {
        hold.remove();
      } catch (e) {
        /* ignore */
      }
    }
    hold = null;
  }

  function armReleaseWatch() {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(releaseHold, MAX_HOLD_MS);
    clearObserver();
    observer = new MutationObserver(() => {
      const live = findLogoCard();
      if (!live) return;
      // New logo is on screen — drop the clone next frame.
      requestAnimationFrame(() => releaseHold());
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function captureLogoHold() {
    if (hold) return;
    const logo = findLogoCard();
    if (!logo) return;
    const { name, text, rect } = logo;
    const cs = window.getComputedStyle(name);

    const el = document.createElement("div");
    el.id = HOLD_ID;
    el.setAttribute("aria-hidden", "true");
    el.textContent = text;
    el.style.cssText = [
      "position:fixed",
      "z-index:10000",
      "pointer-events:none",
      "margin:0",
      "padding:0",
      "white-space:nowrap",
      "color:" + (cs.color || "#fff"),
      "font-family:" + (cs.fontFamily || "inherit"),
      "font-size:" + (cs.fontSize || "18px"),
      "font-weight:" + (cs.fontWeight || "700"),
      "letter-spacing:" + (cs.letterSpacing || "2px"),
      "text-transform:" + (cs.textTransform || "uppercase"),
      "line-height:1",
      "display:flex",
      "align-items:center",
      "left:" + rect.left + "px",
      "top:" + rect.top + "px",
      "height:" + Math.max(rect.height, 22) + "px",
      "width:" + Math.ceil(rect.width) + "px",
    ].join(";");

    document.body.appendChild(el);
    hold = el;
    armReleaseWatch();
  }

  function pathFromClick(ev) {
    const nodes =
      typeof ev.composedPath === "function" ? ev.composedPath() : [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!n || n.nodeType !== 1) continue;
      if (n.tagName !== "BUTTON-CARD") continue;
      const cfg = n.config || n._config;
      const tap = cfg && cfg.tap_action;
      if (
        tap &&
        tap.action === "navigate" &&
        typeof tap.navigation_path === "string"
      ) {
        return tap.navigation_path;
      }
      const vars = cfg && cfg.variables;
      if (vars && typeof vars.path === "string" && onHomioPath(vars.path)) {
        return vars.path;
      }
    }
    return null;
  }

  function clickInHeaderChrome(ev) {
    const nodes =
      typeof ev.composedPath === "function" ? ev.composedPath() : [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!n || n.nodeType !== 1) continue;
      const id = n.id;
      if (
        id === "navigation" ||
        id === "mobile_logo" ||
        id === "mobile_menu_icon"
      ) {
        return true;
      }
    }
    return false;
  }

  function onNavigating(toPath) {
    if (!onHomioPath(location.pathname)) return;
    if (!onHomioPath(toPath)) return;
    if (toPath === location.pathname) return;
    captureLogoHold();
  }

  document.addEventListener(
    "click",
    (ev) => {
      if (!onHomioPath()) return;
      const navPath = pathFromClick(ev);
      if (navPath) {
        onNavigating(navPath);
        return;
      }
      if (clickInHeaderChrome(ev)) {
        const from = location.pathname;
        captureLogoHold();
        setTimeout(() => {
          if (hold && location.pathname === from) releaseHold();
        }, 400);
      }
    },
    true
  );

  function onLocation() {
    if (!onHomioPath()) {
      releaseHold();
      return;
    }
    if (hold) armReleaseWatch();
  }

  window.addEventListener("location-changed", onLocation);
  window.addEventListener("popstate", onLocation);

  const push = history.pushState.bind(history);
  history.pushState = (...args) => {
    const url = args[2];
    if (typeof url === "string") {
      try {
        onNavigating(new URL(url, location.origin).pathname);
      } catch (e) {
        /* ignore */
      }
    }
    push(...args);
    onLocation();
  };
  const replace = history.replaceState.bind(history);
  history.replaceState = (...args) => {
    replace(...args);
    onLocation();
  };
})();
