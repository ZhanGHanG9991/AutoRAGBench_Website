// Site-wide settings: edit these when the paper / code go public.
window.SITE = {
  github: 'https://github.com/ZhanGHanG9991/AutoRAGBench',
  paper: '',            // e.g. 'https://arxiv.org/abs/xxxx.xxxxx' — empty keeps the button disabled
  team: ''              // HTML for the author line in the footer; empty shows the placeholder
};

(function () {
  const S = window.SITE;
  document.querySelectorAll('.js-github').forEach(a => { a.href = S.github; a.target = '_blank'; a.rel = 'noopener'; });
  document.querySelectorAll('.js-paper').forEach(a => {
    if (S.paper) { a.href = S.paper; a.target = '_blank'; a.removeAttribute('aria-disabled'); a.querySelector('span').textContent = 'Read the paper'; }
    else a.addEventListener('click', e => e.preventDefault());
  });
  const team = document.querySelector('.js-team');
  if (team && S.team) team.innerHTML = S.team;

  const root = document.documentElement;
  document.querySelectorAll('.js-theme').forEach(b => b.addEventListener('click', () => {
    const next = U.dark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    window.dispatchEvent(new Event('themechange'));
  }));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => window.dispatchEvent(new Event('themechange')));
})();

const U = {
  D: window.AUTORAG,
  dark() { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; },
  col(a) { return U.dark() ? a.color_dark : a.color; },
  agent(k) { return U.D.agents.find(a => a.key === k); },
  pct: (x, d = 1) => (x * 100).toFixed(d),
  sgn: (x, d = 1) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d),
  mean: a => a.reduce((s, x) => s + x, 0) / a.length,
  median(a) { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; },
  esc: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  // score of a method on one task under answering model r ('avg' = mean of five)
  score(sc, b, r) { return r === 'avg' ? U.mean(Object.values(sc[b])) : sc[b][r]; },
  macro(sc, r) { return U.mean(U.D.benchmarks.map(b => U.score(sc, b.key, r))); },
  // value under (task t | 'avg') and answering model r
  val(sc, t, r) { return t === 'avg' ? U.macro(sc, r) : U.score(sc, t, r); },
  hmTime(min) { const t = Math.round(min), h = Math.floor(t / 60), m = t - h * 60; return `${h}:${String(m).padStart(2, '0')}`; },
  tip: null,
  showTip(e, html) {
    const t = U.tip || (U.tip = document.querySelector('.tip'));
    t.innerHTML = html; t.classList.add('on');
    const w = t.offsetWidth, h = t.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    t.style.left = Math.max(8, x) + 'px'; t.style.top = Math.max(8, y) + 'px';
  },
  hideTip() { if (U.tip) U.tip.classList.remove('on'); },
  bindTips(root) {
    root.querySelectorAll('[data-tip]').forEach(el => {
      el.addEventListener('mousemove', e => U.showTip(e, el.dataset.tip));
      el.addEventListener('mouseleave', U.hideTip);
    });
  },
  heat(v, lo, hi) {
    const a = Math.max(0, Math.min(1, hi > lo ? (v - lo) / (hi - lo) : 0.5));
    return `background: rgba(var(--heat), ${(0.02 + 0.36 * a * a).toFixed(3)})`;
  },
  // re-render hooks for theme and width changes
  renders: [],
  onRender(fn) { U.renders.push(fn); fn(); },
  rerender() { U.renders.forEach(f => f()); }
};
window.addEventListener('themechange', () => U.rerender());
(function () { let w = innerWidth, t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (Math.abs(innerWidth - w) > 40) { w = innerWidth; U.rerender(); } }, 150); }); })();
