(() => {
  // Per-browser header fit: sets CSS vars on documentElement only.
  // Never touches HA entities — a shared input_boolean would sync every client.
  const PATH_RE = /^\/(homio-fixed|homio_dashboard)(\/|$)/;
  const HYSTERESIS = 32;
  const LABELS_FALLBACK = ['Living', 'Dining', 'Kitchen', 'Office', 'Master'];

  let neededPx = 0;
  let timer = 0;
  let lastCompact = null;

  function onHomio() {
    return PATH_RE.test(location.pathname || '');
  }

  function sidebarWidth() {
    const ha = document.querySelector('home-assistant');
    const main = ha && ha.shadowRoot && ha.shadowRoot.querySelector('home-assistant-main');
    const drawer = main && main.shadowRoot && main.shadowRoot.querySelector('ha-drawer');
    if (!drawer) return 0;
    const app = drawer.shadowRoot && drawer.shadowRoot.querySelector('.mdc-drawer-app-content');
    if (app) {
      const left = app.getBoundingClientRect().left;
      if (left > 0 && left < window.innerWidth / 2) return left;
    }
    const mw = parseFloat(getComputedStyle(drawer).getPropertyValue('--mdc-drawer-width'));
    return Number.isFinite(mw) ? mw : 56;
  }

  function availablePx() {
    const content = Math.max(0, window.innerWidth - sidebarWidth());
    const gutter = content * 0.08 * 2; // matches header margin 0 8vw
    return Math.max(0, content - gutter);
  }

  function collectLabels() {
    const labels = [];
    for (const card of document.querySelectorAll('button-card')) {
      const name = card.shadowRoot && card.shadowRoot.querySelector('#name');
      if (!name) continue;
      const text = (name.textContent || '').trim();
      if (!text || text.length > 18) continue;
      if (/[°%]/.test(text) || /^\d/.test(text)) continue;
      if (/daylor|homio/i.test(text)) continue;
      if (/^\d{1,2}:\d{2}/.test(text)) continue;
      if (!labels.includes(text)) labels.push(text);
    }
    return labels.length >= 2 ? labels : LABELS_FALLBACK.slice();
  }

  function measureRow() {
    let logoLeft = null;
    let timeRight = null;
    const links = [];
    for (const card of document.querySelectorAll('button-card')) {
      const name = card.shadowRoot && card.shadowRoot.querySelector('#name');
      if (!name) continue;
      const text = (name.textContent || '').trim();
      const rect = card.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (/^daylor$/i.test(text)) {
        logoLeft = rect.left;
        continue;
      }
      if (/^\d{1,2}:\d{2}/.test(text)) {
        timeRight = rect.right;
        continue;
      }
      if (text.length <= 18 && !/[°%]/.test(text) && !/^\d/.test(text)) {
        links.push(rect);
      }
    }
    if (logoLeft != null && timeRight != null && timeRight > logoLeft) {
      return Math.ceil(timeRight - logoLeft);
    }
    if (links.length >= 2) {
      links.sort((a, b) => a.left - b.left);
      return Math.ceil(links[links.length - 1].right - links[0].left + 220);
    }
    return 0;
  }

  function estimateNeeded() {
    const labels = collectLabels();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '700 15px system-ui, -apple-system, Segoe UI, sans-serif';
    let links = 0;
    for (let i = 0; i < labels.length; i++) {
      links += ctx.measureText(labels[i]).width;
      if (i) links += 36;
    }
    const logo = ctx.measureText('DAYLOR').width + 8;
    const time = ctx.measureText('88:88').width + 8;
    return Math.ceil(logo + links + time + 48);
  }

  function refreshNeeded() {
    const live = measureRow();
    if (live > 0) neededPx = Math.max(neededPx, live);
    else if (!neededPx) neededPx = estimateNeeded();
  }

  function applyMode(compact) {
    const root = document.documentElement;
    root.dataset.homioHeader = compact ? 'compact' : 'full';
    // Inherited into shadow DOM — templates use these as display values.
    root.style.setProperty('--homio-full-header-display', compact ? 'none' : 'grid');
    root.style.setProperty('--homio-compact-ui-display', compact ? 'block' : 'none');
    root.style.setProperty('--homio-drawer-display', compact ? 'grid' : 'none');
    lastCompact = compact;
  }

  function clearMode() {
    const root = document.documentElement;
    root.removeAttribute('data-homio-header');
    root.style.removeProperty('--homio-full-header-display');
    root.style.removeProperty('--homio-compact-ui-display');
    root.style.removeProperty('--homio-drawer-display');
    lastCompact = null;
  }

  function evaluate() {
    if (!onHomio()) {
      clearMode();
      return;
    }
    refreshNeeded();
    const avail = availablePx();
    const need = neededPx || estimateNeeded();
    let want;
    if (lastCompact === true) want = !(avail >= need + HYSTERESIS);
    else if (lastCompact === false) want = avail < need;
    else want = avail < need;
    if (want !== lastCompact) applyMode(want);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(evaluate, 80);
  }

  function boot() {
    // Default to full until measured (avoids mobile chrome flash on wide screens).
    if (onHomio() && lastCompact === null) applyMode(false);
    schedule();
    requestAnimationFrame(schedule);
    setTimeout(schedule, 250);
    setTimeout(schedule, 1000);
  }

  window.addEventListener('resize', schedule);
  window.addEventListener('location-changed', boot);
  window.addEventListener('popstate', boot);
  const push = history.pushState.bind(history);
  history.pushState = (...args) => { push(...args); boot(); };
  const replace = history.replaceState.bind(history);
  history.replaceState = (...args) => { replace(...args); boot(); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
