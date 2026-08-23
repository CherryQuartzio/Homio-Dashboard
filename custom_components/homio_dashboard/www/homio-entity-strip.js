/** Homio entity strip helpers (margin snap, iOS pan, hide scrollbar, pan-vs-tap). */
(() => {
  const PATH_PREFIXES = ["/homio-fixed", "/homio_dashboard"];
  const PAD = "8vw";
  const RETRY_MS = [0, 50, 100, 200, 400, 800, 1500, 3000, 5000];
  const PAN_PX = 10;
  // Interactive nested chrome only — NOT #target_temperature (overlay body must
  // still ripple on touch hold). #temperature_controls lives inside the nested
  // overlay button-card shadow, so we deep-bind + observe.
  const NESTED_CHROME_IDS = ["heating_modes", "temperature_controls", "light-slider"];
  let scheduled = false;
  let retryTimers = [];
  let nestedPressCards = [];
  let nestedRippleRaf = 0;
  let nestedRippleFrames = 0;

  function onHomioPath() {
    const path = window.location.pathname || "";
    if (PATH_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return true;
    // Companion apps sometimes use /lovelace/homio-fixed/... or similar.
    return path.indexOf("homio-fixed") !== -1 || path.indexOf("homio_dashboard") !== -1;
  }

  function isEntityStripRoot(root) {
    if (!root || !root.style) return false;
    const flow = root.style.gridAutoFlow || "";
    const snap = root.style.scrollSnapType || "";
    const cols = root.style.gridAutoColumns || "";
    const ox = root.style.overflowX || "";
    return (
      flow.indexOf("column") !== -1 &&
      (snap.indexOf("x") !== -1 ||
        ox === "auto" ||
        cols.indexOf("260") !== -1)
    );
  }

  function resnapStart(root) {
    requestAnimationFrame(() => {
      if (!root.isConnected) return;
      if (root.scrollLeft > 2) return;
      const prev = root.style.scrollSnapType;
      root.style.scrollSnapType = "none";
      root.scrollLeft = 0;
      void root.offsetWidth;
      root.style.scrollSnapType = prev || "x mandatory";
      try {
        root.scrollTo({ left: 0, behavior: "instant" });
      } catch (e) {
        root.scrollLeft = 0;
      }
    });
  }

  function hideScrollbar(root) {
    root.style.setProperty("scrollbar-width", "none", "important");
    root.style.setProperty("-ms-overflow-style", "none", "important");
    const sr = root.getRootNode && root.getRootNode();
    if (sr && sr instanceof ShadowRoot && !sr.getElementById("homio-strip-scrollbar-hide")) {
      const style = document.createElement("style");
      style.id = "homio-strip-scrollbar-hide";
      style.textContent =
        "#root { scrollbar-width: none !important; -ms-overflow-style: none !important; }" +
        "#root::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }";
      sr.appendChild(style);
    }
  }

  function setPad(root) {
    root.style.setProperty("box-sizing", "border-box", "important");
    root.style.setProperty("padding-left", PAD, "important");
    root.style.setProperty("padding-right", PAD, "important");
    root.style.setProperty("scroll-padding-left", PAD, "important");
    root.style.setProperty("scroll-padding-right", PAD, "important");
    root.style.setProperty("overflow-x", "auto", "important");
    root.style.setProperty("overflow-y", "hidden", "important");
    root.style.setProperty("pointer-events", "auto", "important");
    root.style.setProperty("touch-action", "pan-x", "important");
    root.style.setProperty("-webkit-overflow-scrolling", "touch");
    root.style.setProperty("overscroll-behavior-x", "contain");
    hideScrollbar(root);
    const host = root.getRootNode() && root.getRootNode().host;
    if (host && host.style) {
      host.style.setProperty("pointer-events", "auto", "important");
      host.style.setProperty("touch-action", "pan-x", "important");
    }
  }

  function padMissing(root) {
    return (
      root.style.getPropertyValue("padding-left") !== PAD ||
      root.style.getPropertyValue("scroll-padding-left") !== PAD ||
      root.style.getPropertyValue("overflow-x") !== "auto"
    );
  }

  function ensureKillStyle(root) {
    if (!root || root.getElementById("homio-kill-ripple")) return;
    const style = document.createElement("style");
    style.id = "homio-kill-ripple";
    style.textContent =
      ":host([data-homio-nested-press]) ha-card {" +
      "--ha-ripple-hover-opacity:0!important;" +
      "--ha-ripple-pressed-opacity:0!important;" +
      "--mdc-ripple-hover-opacity:0!important;" +
      "--mdc-ripple-press-opacity:0!important;" +
      "--ha-ripple-color:transparent!important;" +
      "--mdc-ripple-color:transparent!important;" +
      "--primary-color:transparent!important;" +
      "}" +
      ":host([data-homio-nested-press]) ha-ripple," +
      ":host([data-homio-nested-press]) .mdc-ripple-surface::before," +
      ":host([data-homio-nested-press]) .mdc-ripple-surface::after {" +
      "display:none!important;opacity:0!important;pointer-events:none!important;" +
      "}";
    root.appendChild(style);
  }

  function killCardRipple(card) {
    if (!card) return;
    card.setAttribute("data-homio-nested-press", "1");
    try {
      card.style.setProperty("--ha-ripple-hover-opacity", "0", "important");
      card.style.setProperty("--ha-ripple-pressed-opacity", "0", "important");
      card.style.setProperty("--ha-ripple-color", "transparent", "important");
      const root = card.shadowRoot;
      if (!root) return;
      ensureKillStyle(root);
      const haCard = root.querySelector("ha-card");
      if (haCard) {
        haCard.style.setProperty("--ha-ripple-hover-opacity", "0", "important");
        haCard.style.setProperty("--ha-ripple-pressed-opacity", "0", "important");
        haCard.style.setProperty("--mdc-ripple-hover-opacity", "0", "important");
        haCard.style.setProperty("--mdc-ripple-press-opacity", "0", "important");
        haCard.style.setProperty("--ha-ripple-color", "transparent", "important");
        haCard.style.setProperty("--mdc-ripple-color", "transparent", "important");
        haCard.style.setProperty("-webkit-tap-highlight-color", "transparent", "important");
      }
      root.querySelectorAll("ha-ripple").forEach((r) => {
        r.style.setProperty("opacity", "0", "important");
        r.style.setProperty("display", "none", "important");
        r.style.setProperty("pointer-events", "none", "important");
        r.style.setProperty("background", "transparent", "important");
        if (typeof r.disabled === "boolean") r.disabled = true;
      });
    } catch (err) {
      /* ignore */
    }
  }

  function restoreCardRipple(card) {
    if (!card) return;
    try {
      card.removeAttribute("data-homio-nested-press");
      card.style.removeProperty("--ha-ripple-hover-opacity");
      card.style.removeProperty("--ha-ripple-pressed-opacity");
      card.style.removeProperty("--ha-ripple-color");
      const root = card.shadowRoot;
      if (!root) return;
      const haCard = root.querySelector("ha-card");
      if (haCard) {
        [
          "--ha-ripple-hover-opacity",
          "--ha-ripple-pressed-opacity",
          "--mdc-ripple-hover-opacity",
          "--mdc-ripple-press-opacity",
          "--ha-ripple-color",
          "--mdc-ripple-color",
          "-webkit-tap-highlight-color",
        ].forEach((p) => haCard.style.removeProperty(p));
      }
      root.querySelectorAll("ha-ripple").forEach((r) => {
        r.style.removeProperty("opacity");
        r.style.removeProperty("display");
        r.style.removeProperty("pointer-events");
        r.style.removeProperty("background");
        if (typeof r.disabled === "boolean") r.disabled = false;
      });
    } catch (err) {
      /* ignore */
    }
  }

  function ancestorButtonCards(fromEl) {
    const cards = [];
    let node = fromEl;
    let guard = 0;
    while (node && guard++ < 40) {
      const rn = node.getRootNode && node.getRootNode();
      if (rn && rn instanceof ShadowRoot && rn.host) {
        if (rn.host.localName === "button-card") cards.push(rn.host);
        node = rn.host;
      } else {
        node = node.parentElement;
      }
    }
    return cards;
  }

  function startNestedSuppress(cards) {
    nestedPressCards = cards.slice();
    for (let i = 0; i < nestedPressCards.length; i++) killCardRipple(nestedPressCards[i]);
    nestedRippleFrames = 0;
    if (nestedRippleRaf) cancelAnimationFrame(nestedRippleRaf);
    const tick = () => {
      for (let i = 0; i < nestedPressCards.length; i++) killCardRipple(nestedPressCards[i]);
      nestedRippleFrames += 1;
      if (nestedRippleFrames < 30) nestedRippleRaf = requestAnimationFrame(tick);
      else nestedRippleRaf = 0;
    };
    nestedRippleRaf = requestAnimationFrame(tick);
  }

  function clearNestedPress() {
    if (nestedRippleRaf) {
      cancelAnimationFrame(nestedRippleRaf);
      nestedRippleRaf = 0;
    }
    for (let i = 0; i < nestedPressCards.length; i++) restoreCardRipple(nestedPressCards[i]);
    nestedPressCards = [];
  }

  function isChromeId(id) {
    return !!id && NESTED_CHROME_IDS.indexOf(id) !== -1;
  }

  function pointInRect(x, y, r) {
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  // Walk leaf → shadow hosts looking for chrome containers. elementsFromPoint
  // often returns the nested mode/+/- button-card leaf and skips #heating_modes
  // / #temperature_controls (shadow ancestors between leaf and host).
  function findChromeNearNode(node) {
    let n = node;
    let guard = 0;
    while (n && guard++ < 60) {
      if (isChromeId(n.id)) return n;
      const rn = n.getRootNode && n.getRootNode();
      if (rn && rn instanceof ShadowRoot && rn.host) {
        let p = n.parentElement;
        while (p) {
          if (isChromeId(p.id)) return p;
          p = p.parentElement;
        }
        n = rn.host;
      } else {
        n = n.parentElement;
      }
    }
    return null;
  }

  function forEachButtonCardDeep(root, fn) {
    if (!root) return;
    const visit = (node) => {
      if (!node) return;
      if (node.localName === "button-card") fn(node);
      const kids = node.querySelectorAll ? node.querySelectorAll("*") : [];
      for (let i = 0; i < kids.length; i++) {
        const el = kids[i];
        if (el.localName === "button-card") fn(el);
        if (el.shadowRoot) visit(el.shadowRoot);
      }
      if (node.shadowRoot && node.shadowRoot !== node) visit(node.shadowRoot);
    };
    visit(root);
  }

  // Find chrome under the touch. Avoids the "2+ button-cards" rule that killed
  // overlay-body hold ripple. #target_temperature is never chrome.
  function findChromeAtPoint(x, y) {
    try {
      const stack = document.elementsFromPoint(x, y) || [];
      for (let i = 0; i < stack.length; i++) {
        const chrome = findChromeNearNode(stack[i]);
        if (chrome) return chrome;
      }
    } catch (err) {
      /* ignore */
    }
    const seen = [];
    forEachButtonCardDeep(document, (card) => {
      if (seen.indexOf(card) !== -1) return;
      seen.push(card);
    });
    for (let i = 0; i < seen.length; i++) {
      const root = seen[i].shadowRoot;
      if (!root) continue;
      for (let j = 0; j < NESTED_CHROME_IDS.length; j++) {
        const el = root.getElementById(NESTED_CHROME_IDS[j]);
        if (el && pointInRect(x, y, el.getBoundingClientRect())) return el;
      }
    }
    return null;
  }

  function cardsToKillFromChrome(chrome) {
    const cards = ancestorButtonCards(chrome);
    // Also kill nested mode / +/- tiles under the chrome container so their
    // own ha-ripple (often HA blue accent) cannot paint.
    try {
      chrome.querySelectorAll("button-card").forEach((c) => {
        if (cards.indexOf(c) === -1) cards.push(c);
      });
      chrome.querySelectorAll("*").forEach((el) => {
        if (el.localName === "button-card" && cards.indexOf(el) === -1) cards.push(el);
        if (el.shadowRoot) {
          el.shadowRoot.querySelectorAll("button-card").forEach((c) => {
            if (cards.indexOf(c) === -1) cards.push(c);
          });
        }
      });
    } catch (err) {
      /* ignore */
    }
    return cards;
  }

  let clearNestedTimer = 0;

  function markNestedPress(e) {
    if (e.pointerType === "mouse") return;
    const touch = e.touches && e.touches[0];
    const x = e.clientX != null ? e.clientX : (touch && touch.clientX);
    const y = e.clientY != null ? e.clientY : (touch && touch.clientY);
    let chrome = (x != null && y != null) ? findChromeAtPoint(x, y) : null;
    if (!chrome) {
      const path = e.composedPath ? e.composedPath() : [];
      for (let i = 0; i < path.length; i++) {
        chrome = findChromeNearNode(path[i]);
        if (chrome) break;
      }
    }
    if (!chrome) return;
    if (clearNestedTimer) {
      clearTimeout(clearNestedTimer);
      clearNestedTimer = 0;
    }
    const cards = cardsToKillFromChrome(chrome);
    if (!cards.length) return;
    startNestedSuppress(cards);
  }

  function scheduleClearNestedPress() {
    if (clearNestedTimer) clearTimeout(clearNestedTimer);
    // Keep kill active briefly so late ha-ripple paints (blue accent) can't flash.
    clearNestedTimer = setTimeout(() => {
      clearNestedTimer = 0;
      clearNestedPress();
    }, 220);
  }

  function bindChromeEl(el) {
    if (!el || el._homioChromeBound) return;
    el._homioChromeBound = true;
    const onDown = (e) => {
      if (e.pointerType === "mouse") return;
      if (clearNestedTimer) {
        clearTimeout(clearNestedTimer);
        clearNestedTimer = 0;
      }
      const cards = cardsToKillFromChrome(el);
      if (!cards.length) return;
      startNestedSuppress(cards);
    };
    el.addEventListener("pointerdown", onDown, true);
    el.addEventListener("touchstart", onDown, { capture: true, passive: true });
    el.addEventListener("pointerup", scheduleClearNestedPress, true);
    el.addEventListener("pointercancel", scheduleClearNestedPress, true);
    el.addEventListener("touchend", scheduleClearNestedPress, { capture: true, passive: true });
    el.addEventListener("touchcancel", scheduleClearNestedPress, { capture: true, passive: true });
  }

  // Mode: #heating_modes on thermostat shadow. Temp: #temperature_controls on
  // overlay under #target_temperature. Keep this additive and narrow.
  function bindChromeGuards(card) {
    if (!card || !card.shadowRoot) return;
    const root = card.shadowRoot;
    ensureKillStyle(root);
    for (let i = 0; i < NESTED_CHROME_IDS.length; i++) {
      const el = root.getElementById(NESTED_CHROME_IDS[i]);
      if (el) bindChromeEl(el);
    }
    const overlayHost = root.getElementById("target_temperature");
    if (!overlayHost) return;
    const bindOverlay = () => {
      overlayHost.querySelectorAll("button-card").forEach((nested) => {
        bindChromeGuards(nested);
      });
    };
    bindOverlay();
    if (!overlayHost._homioOverlayObs) {
      overlayHost._homioOverlayObs = true;
      new MutationObserver(bindOverlay).observe(overlayHost, {
        childList: true,
        subtree: true,
      });
    }
  }

  // Capture on the card host runs BEFORE ha-card's ripple listeners.
  function bindHitGuard(card) {
    if (!card || card._homioHitGuard) return;
    card._homioHitGuard = true;
    card.addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType === "mouse") return;
        const chrome = findChromeAtPoint(e.clientX, e.clientY);
        if (!chrome) return;
        if (clearNestedTimer) {
          clearTimeout(clearNestedTimer);
          clearNestedTimer = 0;
        }
        const cards = cardsToKillFromChrome(chrome);
        if (cards.indexOf(card) === -1) cards.push(card);
        startNestedSuppress(cards);
      },
      true
    );
  }

  document.addEventListener("pointerdown", markNestedPress, true);
  document.addEventListener("pointerup", scheduleClearNestedPress, true);
  document.addEventListener("pointercancel", scheduleClearNestedPress, true);
  document.addEventListener("lostpointercapture", scheduleClearNestedPress, true);
  document.addEventListener("touchstart", markNestedPress, { capture: true, passive: true });
  document.addEventListener("touchend", scheduleClearNestedPress, { capture: true, passive: true });
  document.addEventListener("touchcancel", scheduleClearNestedPress, { capture: true, passive: true });

  function guardCard(card) {
    if (!card) return;
    bindChromeGuards(card);
    bindHitGuard(card);
    if (card._homioPanGuard) return;
    card._homioPanGuard = true;
    let startX = 0;
    let startY = 0;
    let panning = false;
    let active = false;
    // Horizontal drag on #light-slider (etc.) must not be treated as strip pan —
    // otherwise capture-phase touchend/pointerup is cancelled and the slider
    // never commits brightness on iPad/touch.
    let skipPan = false;

    const clearStickyHover = () => {
      try {
        const root = card.shadowRoot;
        const haCard = root && root.querySelector("ha-card");
        if (haCard) {
          haCard.blur();
          haCard.style.setProperty("filter", "none", "important");
          haCard.style.setProperty("-webkit-filter", "none", "important");
        }
        if (document.activeElement && card.contains(document.activeElement)) {
          document.activeElement.blur();
        }
      } catch (e) {
        /* ignore */
      }
    };

    const gestureOnNestedChrome = (e) => {
      const path = e.composedPath ? e.composedPath() : [];
      for (let i = 0; i < path.length; i++) {
        if (findChromeNearNode(path[i])) return true;
      }
      if (e.clientX != null && e.clientY != null) {
        return !!findChromeAtPoint(e.clientX, e.clientY);
      }
      return false;
    };

    const onDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      active = true;
      panning = false;
      skipPan = gestureOnNestedChrome(e);
      startX = e.clientX;
      startY = e.clientY;
      if (skipPan) {
        card.removeAttribute("data-homio-panning");
        card.setAttribute("data-homio-chrome-drag", "1");
      }
    };

    const onMove = (e) => {
      if (!active || skipPan) return;
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx > PAN_PX && dx > dy) {
        panning = true;
        card.setAttribute("data-homio-panning", "1");
      }
    };

    const onUp = (e) => {
      if (!active) return;
      const wasChrome = skipPan;
      active = false;
      if (panning && !skipPan) {
        e.stopImmediatePropagation();
        e.preventDefault();
        clearStickyHover();
      } else if (wasChrome) {
        // Slider/chrome drag leaves iOS sticky :hover on the parent card —
        // clear so a follow-up hold does not show a warm/yellow cast.
        clearStickyHover();
      }
      panning = false;
      skipPan = false;
      card.removeAttribute("data-homio-panning");
      card.removeAttribute("data-homio-chrome-drag");
    };

    const blockIfPanning = (e) => {
      if (skipPan) return;
      if (card.getAttribute("data-homio-panning") === "1" || panning) {
        e.stopImmediatePropagation();
        e.preventDefault();
        clearStickyHover();
      }
    };

    card.addEventListener("pointerdown", onDown, true);
    card.addEventListener("pointermove", onMove, true);
    card.addEventListener("pointerup", onUp, true);
    card.addEventListener("pointercancel", onUp, true);
    card.addEventListener("click", blockIfPanning, true);
    card.addEventListener("touchend", blockIfPanning, true);
  }

  function guardStripCards(root) {
    if (!root) return;
    root.querySelectorAll("button-card").forEach(guardCard);
    root.querySelectorAll("*").forEach((el) => {
      if (el.localName === "button-card") guardCard(el);
      if (el.shadowRoot) {
        el.shadowRoot.querySelectorAll("button-card").forEach(guardCard);
      }
    });
  }

  function fixRoot(root) {
    if (!isEntityStripRoot(root)) return false;
    const missing = padMissing(root);
    setPad(root);
    guardStripCards(root);
    if (missing) resnapStart(root);
    return missing;
  }

  function watchRoot(root) {
    if (!root) return;
    if (!root._homioStripObserved) {
      root._homioStripObserved = true;
      new MutationObserver(() => {
        fixRoot(root);
      }).observe(root, {
        attributes: true,
        attributeFilter: ["style"],
        childList: true,
        subtree: true,
      });
    }
    fixRoot(root);
  }

  function walk(node) {
    if (!node) return;
    if (node.shadowRoot) {
      const root = node.shadowRoot.querySelector("#root");
      if (root) watchRoot(root);
      node.shadowRoot.querySelectorAll("button-card").forEach(guardCard);
      node.shadowRoot.querySelectorAll("*").forEach(walk);
    }
  }

  function run() {
    if (!onHomioPath()) return;
    document.querySelectorAll("*").forEach(walk);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      run();
    });
  }

  function burst() {
    retryTimers.forEach(clearTimeout);
    retryTimers = RETRY_MS.map((ms) => setTimeout(schedule, ms));
  }

  const obs = new MutationObserver(schedule);
  function start() {
    if (document.body) {
      obs.observe(document.body, { childList: true, subtree: true });
    }
    burst();
  }

  window.addEventListener("location-changed", burst);
  window.addEventListener("popstate", burst);
  window.addEventListener("pageshow", burst);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) burst();
  });

  Promise.resolve(customElements.whenDefined("grid-layout")).then(burst).catch(() => {});
  Promise.resolve(customElements.whenDefined("layout-card")).then(burst).catch(() => {});
  Promise.resolve(customElements.whenDefined("button-card")).then(burst).catch(() => {});

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
