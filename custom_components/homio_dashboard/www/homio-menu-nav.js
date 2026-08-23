(() => {
  // Per-browser mobile menu open/close. Never touches HA entities — a shared
  // input_boolean.homio_mobile_navigation would sync every client.
  const PATH_RE = /^\/(homio-fixed|homio_dashboard)(\/|$)/;
  let menuOpen = false;
  let timer = 0;

  function onHomio() {
    const p = location.pathname || "";
    return PATH_RE.test(p) || p.indexOf("homio-fixed") !== -1;
  }

  function isCompact() {
    return document.documentElement.dataset.homioHeader === "compact";
  }

  function apply() {
    const root = document.documentElement;
    if (!onHomio()) {
      menuOpen = false;
      root.removeAttribute("data-homio-menu");
      [
        "--homio-menu-panel-display",
        "--homio-menu-burger-display",
        "--homio-menu-close-display",
        "--homio-menu-icon-top",
        "--homio-entity-when-menu",
        "--homio-room-pointer-events",
        "--homio-mobile-logo-display",
      ].forEach((p) => root.style.removeProperty(p));
      return;
    }

    const compact = isCompact();
    if (!compact) menuOpen = false;
    const open = !!(menuOpen && compact);

    root.dataset.homioMenu = open ? "open" : "closed";
    root.style.setProperty("--homio-menu-panel-display", open ? "grid" : "none");
    root.style.setProperty("--homio-menu-burger-display", open ? "none" : "block");
    root.style.setProperty("--homio-menu-close-display", open ? "block" : "none");
    // 28×23 burger centered on DAYLOR (18px @ 60px): top = 60 + (18-23)/2 = 57.5.
    root.style.setProperty("--homio-menu-icon-top", "57.5px");
    root.style.setProperty("--homio-entity-when-menu", open ? "none" : "block");
    root.style.setProperty("--homio-room-pointer-events", open ? "all" : "none");

    const compactDisp =
      getComputedStyle(root).getPropertyValue("--homio-compact-ui-display").trim() ||
      "none";
    root.style.setProperty(
      "--homio-mobile-logo-display",
      open ? "none" : compactDisp
    );
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(apply, 40);
  }

  function toggle() {
    if (!isCompact()) return;
    menuOpen = !menuOpen;
    apply();
  }

  function close() {
    if (!menuOpen) return;
    menuOpen = false;
    apply();
  }

  document.addEventListener("ll-custom", (ev) => {
    const d = ev.detail || {};
    if (d.homio_action === "menu_toggle") toggle();
    else if (d.homio_action === "menu_close") close();
  });

  window.addEventListener("location-changed", () => {
    menuOpen = false;
    schedule();
  });
  window.addEventListener("popstate", () => {
    menuOpen = false;
    schedule();
  });
  window.addEventListener("pageshow", schedule);

  const obs = new MutationObserver(schedule);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-homio-header", "style", "class"],
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      apply();
      schedule();
    });
  } else {
    apply();
    schedule();
  }

  window.__homioMenuNav = {
    toggle,
    close,
    apply,
    get open() {
      return menuOpen;
    },
  };
})();
