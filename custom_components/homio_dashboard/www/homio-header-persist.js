/** Keep Homio header visible across room view swaps.
 *
 * Each room is a separate Lovelace view, so navigate destroys the room card
 * (and its nested nav). We move the live room host into a fixed hold overlay
 * for the gap, then drop it once the next room's #navigation is connected.
 */
(() => {
  const PATH_RE = /^\/(homio-fixed|homio_dashboard)(\/|$)/;
  const HOLD_ID = "homio-view-hold";
  const MAX_HOLD_MS = 2500;
  let hold = null;
  let releaseTimer = 0;
  let observer = null;
  let pathAtHold = null;

  function onHomioPath(path) {
    return PATH_RE.test(path || location.pathname || "");
  }

  function findRoomHosts() {
    const out = [];
    const visit = (node) => {
      if (!node) return;
      if (node.nodeType === 1) {
        if (node.tagName === "BUTTON-CARD" && node.shadowRoot) {
          if (node.shadowRoot.querySelector("#navigation")) out.push(node);
        }
        if (node.shadowRoot) visit(node.shadowRoot);
        const kids = node.children;
        if (kids) for (let i = 0; i < kids.length; i++) visit(kids[i]);
      } else if (node instanceof ShadowRoot) {
        const kids = node.children;
        if (kids) for (let i = 0; i < kids.length; i++) visit(kids[i]);
      }
    };
    visit(document.body);
    return out;
  }

  function liveRoomHost() {
    return (
      findRoomHosts().filter((r) => !hold || !hold.contains(r))[0] || null
    );
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
    pathAtHold = null;
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
      if (!liveRoomHost()) return;
      requestAnimationFrame(() => releaseHold());
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function captureHold() {
    if (hold) return;
    const room = liveRoomHost();
    if (!room || !room.isConnected) return;
    const rect = room.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return;

    const wrap = document.createElement("div");
    wrap.id = HOLD_ID;
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText =
      "position:fixed;z-index:6;pointer-events:none;overflow:hidden;contain:strict;";
    wrap.style.left = rect.left + "px";
    wrap.style.top = rect.top + "px";
    wrap.style.width = rect.width + "px";
    wrap.style.height = rect.height + "px";

    // Move (not clone) so shadow DOM / live header stay painted.
    wrap.appendChild(room);
    room.style.setProperty("pointer-events", "none", "important");
    document.body.appendChild(wrap);
    hold = wrap;
    pathAtHold = location.pathname || "";
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
      if (tap && tap.action === "navigate" && typeof tap.navigation_path === "string") {
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
    captureHold();
  }

  // Capture-phase: hold before HA tears down the view.
  document.addEventListener(
    "click",
    (ev) => {
      if (!onHomioPath()) return;
      const navPath = pathFromClick(ev);
      if (navPath) {
        onNavigating(navPath);
        return;
      }
      // Fallback: any click in the header chrome that may navigate.
      if (clickInHeaderChrome(ev)) {
        const from = location.pathname;
        captureHold();
        // If path did not change, drop the hold (e.g. menu toggle).
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
