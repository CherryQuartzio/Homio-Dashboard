/** Homio nested-chrome ripple kill (touch only). Additive; keeps body-hold ripple. */
(() => {
  const CHROME = ["heating_modes", "temperature_controls", "light-slider"];
  const ATTR = "data-homio-nested-press";
  let cards = [];
  let raf = 0;
  let frames = 0;
  let clearTimer = 0;

  function isChromeId(id) {
    return !!id && CHROME.indexOf(id) !== -1;
  }

  function nearChrome(node) {
    let n = node;
    let g = 0;
    while (n && g++ < 60) {
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

  function chromeAtPoint(x, y) {
    try {
      const stack = document.elementsFromPoint(x, y) || [];
      for (let i = 0; i < stack.length; i++) {
        const c = nearChrome(stack[i]);
        if (c) return c;
      }
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  function ancestorCards(fromEl) {
    const out = [];
    let node = fromEl;
    let g = 0;
    while (node && g++ < 40) {
      const rn = node.getRootNode && node.getRootNode();
      if (rn && rn instanceof ShadowRoot && rn.host) {
        if (rn.host.localName === "button-card") out.push(rn.host);
        node = rn.host;
      } else {
        node = node.parentElement;
      }
    }
    return out;
  }

  function kill(card) {
    if (!card) return;
    card.setAttribute(ATTR, "1");
    try {
      card.style.setProperty("--ha-ripple-pressed-opacity", "0", "important");
      card.style.setProperty("--ha-ripple-hover-opacity", "0", "important");
      card.style.setProperty("--ha-ripple-color", "transparent", "important");
      card.style.setProperty("--primary-color", "transparent", "important");
      const root = card.shadowRoot;
      if (!root) return;
      const ha = root.querySelector("ha-card");
      if (ha) {
        ha.style.setProperty("--ha-ripple-pressed-opacity", "0", "important");
        ha.style.setProperty("--ha-ripple-hover-opacity", "0", "important");
        ha.style.setProperty("--mdc-ripple-press-opacity", "0", "important");
        ha.style.setProperty("--ha-ripple-color", "transparent", "important");
        ha.style.setProperty("--mdc-ripple-color", "transparent", "important");
        ha.style.setProperty("--primary-color", "transparent", "important");
      }
      root.querySelectorAll("ha-ripple").forEach((r) => {
        r.style.setProperty("display", "none", "important");
        r.style.setProperty("opacity", "0", "important");
        if (typeof r.disabled === "boolean") r.disabled = true;
      });
    } catch (e) {
      /* ignore */
    }
  }

  function restore(card) {
    if (!card) return;
    try {
      card.removeAttribute(ATTR);
      ["--ha-ripple-pressed-opacity", "--ha-ripple-hover-opacity", "--ha-ripple-color", "--primary-color"].forEach((p) =>
        card.style.removeProperty(p)
      );
      const root = card.shadowRoot;
      if (!root) return;
      const ha = root.querySelector("ha-card");
      if (ha) {
        [
          "--ha-ripple-pressed-opacity",
          "--ha-ripple-hover-opacity",
          "--mdc-ripple-press-opacity",
          "--ha-ripple-color",
          "--mdc-ripple-color",
          "--primary-color",
        ].forEach((p) => ha.style.removeProperty(p));
      }
      root.querySelectorAll("ha-ripple").forEach((r) => {
        r.style.removeProperty("display");
        r.style.removeProperty("opacity");
        if (typeof r.disabled === "boolean") r.disabled = false;
      });
    } catch (e) {
      /* ignore */
    }
  }

  function collect(chrome) {
    const out = ancestorCards(chrome);
    try {
      chrome.querySelectorAll("button-card").forEach((c) => {
        if (out.indexOf(c) === -1) out.push(c);
      });
      chrome.querySelectorAll("*").forEach((el) => {
        if (el.localName === "button-card" && out.indexOf(el) === -1) out.push(el);
        if (el.shadowRoot) {
          el.shadowRoot.querySelectorAll("button-card").forEach((c) => {
            if (out.indexOf(c) === -1) out.push(c);
          });
        }
      });
    } catch (e) {
      /* ignore */
    }
    return out;
  }

  function start(list) {
    cards = list.slice();
    for (let i = 0; i < cards.length; i++) kill(cards[i]);
    frames = 0;
    if (raf) cancelAnimationFrame(raf);
    const tick = () => {
      for (let i = 0; i < cards.length; i++) kill(cards[i]);
      frames += 1;
      if (frames < 30) raf = requestAnimationFrame(tick);
      else raf = 0;
    };
    raf = requestAnimationFrame(tick);
  }

  function clear() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    for (let i = 0; i < cards.length; i++) restore(cards[i]);
    cards = [];
  }

  function scheduleClear() {
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      clearTimer = 0;
      clear();
    }, 220);
  }

  function onDown(e) {
    if (e.pointerType === "mouse") return;
    const touch = e.touches && e.touches[0];
    const x = e.clientX != null ? e.clientX : touch && touch.clientX;
    const y = e.clientY != null ? e.clientY : touch && touch.clientY;
    let chrome = x != null && y != null ? chromeAtPoint(x, y) : null;
    if (!chrome) {
      const path = e.composedPath ? e.composedPath() : [];
      for (let i = 0; i < path.length; i++) {
        chrome = nearChrome(path[i]);
        if (chrome) break;
      }
    }
    if (!chrome) return;
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = 0;
    }
    const list = collect(chrome);
    if (!list.length) return;
    start(list);
  }

  document.addEventListener("pointerdown", onDown, true);
  document.addEventListener("touchstart", onDown, { capture: true, passive: true });
  document.addEventListener("pointerup", scheduleClear, true);
  document.addEventListener("pointercancel", scheduleClear, true);
  document.addEventListener("touchend", scheduleClear, { capture: true, passive: true });
  document.addEventListener("touchcancel", scheduleClear, { capture: true, passive: true });
})();
