/** Keep the Homio logo painted across room view swaps.
 *
 * SAFE: light-DOM text overlay only — never reparent Lit/Lovelace nodes.
 *
 * Strategy: while on a Homio path the overlay is the only visible logo. Live
 * logo cards stay at opacity 0 (still receive taps). That way room remounts
 * cannot run fadeIn on the painted logo.
 */
(() => {
  const PATH_RE = /^\/(homio-fixed|homio_dashboard)(\/|$)/;
  const HOLD_ID = "homio-logo-hold";
  let hold = null;
  let syncTimer = 0;
  let observer = null;
  let active = false;

  function onHomioPath(path) {
    return PATH_RE.test(path || location.pathname || "");
  }

  function setLiveLogoOpacity(visible) {
    document.documentElement.style.setProperty(
      "--homio-logo-live-opacity",
      visible ? "1" : "0"
    );
  }

  function isLogoName(text) {
    if (!text) return false;
    const t = text.trim();
    if (!t || t.length > 24) return false;
    if (/[°%]/.test(t) || /^\d/.test(t)) return false;
    if (/^\d{1,2}:\d{2}/.test(t)) return false;
    return /^[A-Za-z][A-Za-z0-9 .'-]{0,22}\.?$/.test(t);
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
      // Opacity-0 cards still have geometry; require a real box.
      if (rect.width < 2 || rect.height < 2) continue;
      let score = 0;
      if (rect.top >= 40 && rect.top <= 100) score += 5;
      if (rect.height <= 40) score += 3;
      if (rect.left < window.innerWidth * 0.4) score += 2;
      if (/homio|home|daylor/i.test(text)) score += 4;
      if (rect.height > 50 || rect.width > window.innerWidth * 0.55) continue;
      if (score > bestScore) {
        bestScore = score;
        best = { card, name, text, rect };
      }
    }
    return best;
  }

  function ensureHold() {
    if (hold && hold.isConnected) return hold;
    const el = document.createElement("div");
    el.id = HOLD_ID;
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = [
      "position:fixed",
      "z-index:10000",
      "pointer-events:none",
      "margin:0",
      "padding:0",
      "white-space:nowrap",
      "line-height:1",
      "display:flex",
      "align-items:center",
      "opacity:1",
      "transition:none",
      "animation:none",
    ].join(";");
    document.body.appendChild(el);
    hold = el;
    return hold;
  }

  function paintHold(logo) {
    const el = ensureHold();
    const { name, text, rect } = logo;
    const cs = window.getComputedStyle(name);
    el.textContent = text;
    el.style.color = cs.color || "#fff";
    el.style.fontFamily = cs.fontFamily || "inherit";
    el.style.fontSize = cs.fontSize || "18px";
    el.style.fontWeight = cs.fontWeight || "700";
    el.style.letterSpacing = cs.letterSpacing || "2px";
    el.style.textTransform = cs.textTransform || "uppercase";
    el.style.left = rect.left + "px";
    el.style.top = rect.top + "px";
    el.style.height = Math.max(rect.height, 22) + "px";
    el.style.width = Math.ceil(rect.width) + "px";
    el.style.opacity = "1";
    el.style.visibility = "visible";
  }

  function syncFromLive() {
    if (!active) return;
    const logo = findLogoCard();
    if (!logo) return;
    paintHold(logo);
    setLiveLogoOpacity(false);
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = 0;
      syncFromLive();
    }, 50);
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
    if (active) {
      scheduleSync();
      return;
    }
    active = true;
    setLiveLogoOpacity(false);
    armObserver();
    syncFromLive();
    // Remounts can lag a few frames after navigation.
    requestAnimationFrame(() => {
      syncFromLive();
      requestAnimationFrame(syncFromLive);
    });
    setTimeout(syncFromLive, 120);
    setTimeout(syncFromLive, 350);
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
    setLiveLogoOpacity(true);
  }

  function onLocation() {
    if (onHomioPath()) activate();
    else deactivate();
  }

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
    push(...args);
    onLocation();
  };
  const replace = history.replaceState.bind(history);
  history.replaceState = (...args) => {
    replace(...args);
    onLocation();
  };

  // Header compact/full swaps which logo card is visible.
  const ro =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          if (active) scheduleSync();
        })
      : null;
  if (ro) ro.observe(document.documentElement);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onLocation);
  } else {
    onLocation();
  }
})();
