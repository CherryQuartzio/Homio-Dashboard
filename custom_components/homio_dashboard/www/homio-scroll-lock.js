(() => {
  const STYLE_ID = 'homio-scroll-lock';
  // Lightweight: CSS on known shells only. No full shadow-DOM walks (those tanked navigation).
  const CSS = `
    html, body {
      overflow-y: hidden !important;
      overscroll-behavior: none !important;
    }
    ha-drawer,
    .mdc-drawer-app-content,
    partial-panel-resolver,
    ha-panel-lovelace,
    #view,
    hui-view,
    hui-panel-view {
      overflow-y: hidden !important;
      overscroll-behavior: none !important;
    }
  `;

  function isHomio() {
    const p = location.pathname || '';
    return p.indexOf('/homio-fixed') === 0 || p.indexOf('/homio_dashboard') === 0;
  }

  function roots() {
    const list = [document];
    const ha = document.querySelector('home-assistant');
    if (ha && ha.shadowRoot) list.push(ha.shadowRoot);
    const main = ha && ha.shadowRoot && ha.shadowRoot.querySelector('home-assistant-main');
    if (main && main.shadowRoot) list.push(main.shadowRoot);
    const drawer = main && main.shadowRoot && main.shadowRoot.querySelector('ha-drawer');
    if (drawer && drawer.shadowRoot) list.push(drawer.shadowRoot);
    const panel = main && main.shadowRoot && main.shadowRoot.querySelector('ha-panel-lovelace');
    if (panel && panel.shadowRoot) list.push(panel.shadowRoot);
    return list;
  }

  function apply() {
    const on = isHomio();
    for (const root of roots()) {
      const get = root === document
        ? (id) => document.getElementById(id)
        : (id) => root.getElementById && root.getElementById(id);
      let el = get(STYLE_ID);
      if (!on) {
        if (el) el.remove();
        continue;
      }
      if (!el) {
        el = document.createElement('style');
        el.id = STYLE_ID;
        if (root === document) (document.head || document.documentElement).appendChild(el);
        else root.appendChild(el);
      }
      el.textContent = CSS;
    }
    if (on) {
      document.documentElement.style.setProperty('overflow-y', 'hidden', 'important');
      if (document.body) document.body.style.setProperty('overflow-y', 'hidden', 'important');
    } else {
      document.documentElement.style.removeProperty('overflow-y');
      if (document.body) document.body.style.removeProperty('overflow-y');
    }
  }

  function schedule() {
    apply();
    requestAnimationFrame(apply);
    setTimeout(apply, 200);
  }

  schedule();
  window.addEventListener('location-changed', schedule);
  window.addEventListener('popstate', schedule);
  const push = history.pushState.bind(history);
  history.pushState = (...args) => { push(...args); schedule(); };
  const replace = history.replaceState.bind(history);
  history.replaceState = (...args) => { replace(...args); schedule(); };
})();
