(() => {
  // Lift room temp/name/humidity only when they collide with the entity strip.
  // button-card hosts live in nested shadow roots — never use document.querySelectorAll alone.
  // CSS var is set on documentElement (like header-fit) so button-card re-renders cannot wipe it.
  //
  // SAFETY: never trust strip measurements in the upper half of the room (full-bleed
  // #entities wrappers can report a bogus top and shove the title off-screen).
  const GAP = 28;
  const HYST = 10;
  const CARD_H = 170;
  const STRIP_BOTTOM_INSET = 85;
  const LIFT_VAR = "--homio-room-text-lift";
  const HEADER_GUARD = 72;
  const RETRY_MS = [0, 50, 100, 200, 400, 800, 1500, 3000, 5000];

  let timer = 0;
  let lastLift = 0;
  let retryTimers = [];

  function onHomio() {
    const p = location.pathname || "";
    return p.indexOf("/homio-fixed") === 0 || p.indexOf("/homio_dashboard") === 0;
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

  function findRoom() {
    let best = null;
    let bestArea = 0;
    for (const card of allButtonCards()) {
      const root = card.shadowRoot;
      if (!root) continue;
      if (!root.querySelector("#entities")) continue;
      if (!root.querySelector("#name")) continue;
      const rect = card.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 120) continue;
      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        best = { card, root, rect };
      }
    }
    return best;
  }

  function textBottom(root, lift) {
    let bottom = 0;
    let any = false;
    for (const sel of ["#temperature", "#name", "#humidity"]) {
      const el = root.querySelector(sel);
      if (!el) continue;
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      // getBoundingClientRect is post-transform; add lift back to pre-transform bottom.
      bottom = Math.max(bottom, r.bottom + lift);
      any = true;
    }
    return any ? bottom : 0;
  }

  function geometryStripTop(roomRect) {
    return roomRect.bottom - STRIP_BOTTOM_INSET - CARD_H;
  }

  function stripTop(room) {
    const roomRect = room.rect || room.card.getBoundingClientRect();
    const byGeometry = geometryStripTop(roomRect);
    // Entity strip lives in the lower portion; reject anything above mid-room.
    const minAcceptable = roomRect.top + roomRect.height * 0.55;
    let measured = Infinity;
    const entities = room.root.querySelector("#entities");
    if (entities) {
      const stack = [entities];
      const seen = new Set();
      while (stack.length) {
        const n = stack.pop();
        if (!n || seen.has(n)) continue;
        seen.add(n);
        if (n.localName === "button-card" && n !== room.card) {
          const r = n.getBoundingClientRect();
          if (
            r.height >= 100 &&
            r.height <= 220 &&
            r.width >= 60 &&
            r.width <= 400 &&
            r.top >= minAcceptable
          ) {
            measured = Math.min(measured, r.top);
          }
        }
        if (n.shadowRoot) stack.push(n.shadowRoot);
        if (n.children) for (const c of n.children) stack.push(c);
      }
      const layouts = [];
      const layoutStack = [entities];
      const layoutSeen = new Set();
      while (layoutStack.length) {
        const n = layoutStack.pop();
        if (!n || layoutSeen.has(n)) continue;
        layoutSeen.add(n);
        if (n.localName === "layout-card" || n.localName === "grid-layout") {
          layouts.push(n);
        }
        if (n.shadowRoot) layoutStack.push(n.shadowRoot);
        if (n.querySelectorAll) {
          n.querySelectorAll("*").forEach((c) => {
            if (c.shadowRoot) layoutStack.push(c.shadowRoot);
            if (c.localName === "layout-card" || c.localName === "grid-layout") {
              layouts.push(c);
            }
          });
        }
      }
      for (const layout of layouts) {
        const hostBox = layout.getBoundingClientRect();
        // Layout host itself must sit in the bottom band (inset: auto 0 85px 0).
        if (hostBox.top < minAcceptable || hostBox.height > CARD_H + 80) continue;
        const sr = layout.shadowRoot;
        const root = sr && (sr.querySelector("#root") || sr.querySelector(".container"));
        if (!root) continue;
        for (const child of root.children) {
          const r = child.getBoundingClientRect();
          if (
            r.height >= 80 &&
            r.height <= 220 &&
            r.width >= 60 &&
            r.top >= minAcceptable
          ) {
            measured = Math.min(measured, r.top);
          }
        }
      }
    }
    if (measured === Infinity || measured < minAcceptable) return byGeometry;
    return measured;
  }

  function ensureRoomStyles(root) {
    let style = root.getElementById("homio-room-text-fit");
    if (!style) {
      style = document.createElement("style");
      style.id = "homio-room-text-fit";
      root.appendChild(style);
    }
    style.textContent =
      "#temperature, #name, #humidity {" +
      "transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1) !important;" +
      "transform: translateY(calc(-1 * var(--homio-room-text-lift, 0px))) !important;" +
      "}";
  }

  function setLift(room, px) {
    if (room && room.root) ensureRoomStyles(room.root);
    document.documentElement.style.setProperty(
      LIFT_VAR,
      `${Math.max(0, Math.round(px))}px`
    );
  }

  function clearLift() {
    document.documentElement.style.removeProperty(LIFT_VAR);
    lastLift = 0;
  }

  function maxAllowedLift(room, unliftedBottom) {
    // Keep ~100px of title block below the header band after lift.
    const maxFromHeader = Math.max(
      0,
      unliftedBottom - (room.rect.top + HEADER_GUARD) - 100
    );
    // Never lift more than ~22% of the room — prevents off-viewport titles.
    const maxFromRoom = Math.round(room.rect.height * 0.22);
    return Math.min(maxFromHeader, maxFromRoom);
  }

  function evaluate() {
    if (!onHomio()) {
      clearLift();
      window.__homioRoomTextFit = {
        found: false,
        reason: "off-path",
        path: location.pathname,
      };
      return;
    }
    const room = findRoom();
    if (!room) {
      clearLift();
      window.__homioRoomTextFit = {
        found: false,
        reason: "no-room",
        cards: allButtonCards().length,
        path: location.pathname,
      };
      return;
    }
    const bottom = textBottom(room.root, lastLift);
    if (!bottom) {
      // No measurable text — do not keep a stale lift that could hide a remount.
      setLift(room, 0);
      lastLift = 0;
      window.__homioRoomTextFit = {
        found: true,
        reason: "no-text",
        path: location.pathname,
      };
      return;
    }
    const top = stripTop(room);
    let needed = Math.max(0, bottom + GAP - top);
    if (needed < lastLift && lastLift - needed < HYST) needed = lastLift;
    needed = Math.min(needed, maxAllowedLift(room, bottom));
    setLift(room, needed);
    lastLift = needed;
    window.__homioRoomTextFit = {
      found: true,
      bottom,
      top,
      needed,
      gap: GAP,
      path: location.pathname,
    };
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(evaluate, 40);
  }

  function burst() {
    lastLift = 0;
    clearLift();
    retryTimers.forEach(clearTimeout);
    retryTimers = RETRY_MS.map((ms) => setTimeout(schedule, ms));
    schedule();
    requestAnimationFrame(schedule);
  }

  window.addEventListener("resize", schedule);
  window.addEventListener("location-changed", burst);
  window.addEventListener("popstate", burst);
  window.addEventListener("pageshow", burst);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) burst();
  });
  const push = history.pushState.bind(history);
  history.pushState = (...args) => {
    push(...args);
    burst();
  };
  const replace = history.replaceState.bind(history);
  history.replaceState = (...args) => {
    replace(...args);
    burst();
  };

  if (window.ResizeObserver) {
    try {
      new ResizeObserver(schedule).observe(document.documentElement);
    } catch (e) {
      /* ignore */
    }
  }

  const mo = new MutationObserver(schedule);
  function start() {
    if (document.body) {
      mo.observe(document.body, { childList: true, subtree: true });
    }
    burst();
  }

  Promise.resolve(customElements.whenDefined("button-card")).then(burst).catch(() => {});

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
