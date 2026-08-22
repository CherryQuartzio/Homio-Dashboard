(() => {
  const STYLE_ID = 'homio-theme-fix';
  const CSS = `
    html {
      --primary-font-family: "Hanken Grotesk", sans-serif !important;
      --ha-font-family-body: "Hanken Grotesk", sans-serif !important;
      --ha-card-header-font-family: "Hanken Grotesk", sans-serif !important;
      --ha-card-border-width: 0px !important;
      --ha-card-border-color: transparent !important;
      font-family: "Hanken Grotesk", sans-serif !important;
    }
  `;

  function isHomioDashboard() {
    const p = location.pathname || '';
    return p.indexOf('/homio-fixed') === 0 || p.indexOf('/homio_dashboard') === 0;
  }

  function apply() {
    let el = document.getElementById(STYLE_ID);
    if (!isHomioDashboard()) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = CSS;
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
