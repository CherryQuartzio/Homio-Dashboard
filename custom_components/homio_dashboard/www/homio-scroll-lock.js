(() => {
  const STYLE_ID = 'homio-scroll-lock';
  const MARK = 'data-homio-oy';
  const CSS = `
    html, body {
      overflow-y: hidden !important;
      overscroll-behavior: none !important;
    }
  `;

  function isHomio() {
    const p = location.pathname || '';
    return p.indexOf('/homio-fixed') === 0 || p.indexOf('/homio_dashboard') === 0;
  }

  function ensureDocStyle(on) {
    let el = document.getElementById(STYLE_ID);
    if (!on) {
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

  function clearMarks(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('[' + MARK + ']').forEach((el) => {
      el.style.removeProperty('overflow-y');
      el.removeAttribute(MARK);
    });
    if (root.shadowRoot) clearMarks(root.shadowRoot);
    const kids = root.children ? Array.from(root.children) : [];
    for (const k of kids) {
      if (k.shadowRoot) clearMarks(k.shadowRoot);
      clearMarks(k);
    }
  }

  function clampTree(root, depth) {
    if (!root || depth > 12) return;
    const nodes = [];
    if (root.querySelectorAll) {
      try { nodes.push(...root.querySelectorAll('*')); } catch (e) {}
    }
    if (root.nodeType === 1) nodes.unshift(root);
    for (const el of nodes) {
      if (!el || el.nodeType !== 1) continue;
      // Never kill horizontal entity strip scrolling.
      const sh = el.scrollHeight, ch = el.clientHeight;
      if (ch > 0 && sh > ch + 1) {
        el.style.setProperty('overflow-y', 'hidden', 'important');
        el.setAttribute(MARK, '1');
      }
      if (el.shadowRoot) clampTree(el.shadowRoot, depth + 1);
    }
  }

  function apply() {
    const on = isHomio();
    ensureDocStyle(on);
    if (!on) {
      clearMarks(document.documentElement);
      return;
    }
    document.documentElement.style.setProperty('overflow-y', 'hidden', 'important');
    if (document.body) document.body.style.setProperty('overflow-y', 'hidden', 'important');
    clampTree(document.documentElement, 0);
    const ha = document.querySelector('home-assistant');
    if (ha) clampTree(ha, 0);
  }

  function schedule() {
    apply();
    requestAnimationFrame(apply);
    setTimeout(apply, 50);
    setTimeout(apply, 250);
    setTimeout(apply, 800);
    setTimeout(apply, 2000);
  }

  schedule();
  window.addEventListener('location-changed', schedule);
  window.addEventListener('popstate', schedule);
  window.addEventListener('resize', schedule);
  const push = history.pushState.bind(history);
  history.pushState = (...args) => { push(...args); schedule(); };
  const replace = history.replaceState.bind(history);
  history.replaceState = (...args) => { replace(...args); schedule(); };
  let n = 0;
  const iv = setInterval(() => { apply(); if (++n > 40) clearInterval(iv); }, 500);

  // Dev helper: window.__homioOverflowReport()
  window.__homioOverflowReport = function () {
    const hits = [];
    function walk(root, path) {
      if (!root) return;
      const list = [];
      if (root.nodeType === 1) list.push(root);
      if (root.querySelectorAll) {
        try { list.push(...root.querySelectorAll('*')); } catch (e) {}
      }
      for (const el of list) {
        if (!el || el.nodeType !== 1) continue;
        const sh = el.scrollHeight, ch = el.clientHeight;
        if (ch > 40 && sh > ch + 1) {
          const tag = el.tagName ? el.tagName.toLowerCase() : '?';
          const id = el.id ? '#' + el.id : '';
          const cls = (el.className && typeof el.className === 'string')
            ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
            : '';
          hits.push({
            path: path + ' > ' + tag + id + cls,
            scrollHeight: sh,
            clientHeight: ch,
            delta: sh - ch,
            overflowY: getComputedStyle(el).overflowY,
          });
        }
        if (el.shadowRoot) walk(el.shadowRoot, path + ' > ' + (el.tagName || '?').toLowerCase() + '#shadow');
      }
    }
    walk(document.documentElement, 'html');
    hits.sort((a, b) => b.delta - a.delta);
    console.table(hits.slice(0, 25));
    return hits.slice(0, 25);
  };
})();
