(function () {
  const D = U.D, B = D.benchmarks, T = D.traces;
  const $ = s => document.querySelector(s);
  const agent = D.agents.find(a => a.key === 'gpt61sol_codex');
  const ref = D.refs.find(r => r.key === 'ref');
  const KINDS = [['cmd', 'command'], ['patch', 'edit'], ['say', 'agent'], ['sc', 'self_check'], ['out', 'output'], ['note', 'note'], ['timer', 'timer']];
  const hidden = new Set();
  $('.js-agent').textContent = D.trace_agent;

  const spark = (tr, w = 240, h = 26) => {
    const c = tr.selfcheck; if (c.length < 2) return '';
    const vs = c.map(p => p[1]), lo = Math.min(...vs), hi = Math.max(...vs) || 1;
    const pts = c.map(p => `${(p[0] / 360 * w).toFixed(1)},${(h - 3 - (p[1] - lo) / ((hi - lo) || 1) * (h - 6)).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="var(--k-sc)" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
  };

  const list = $('.js-list');
  list.innerHTML = B.map(b => {
    const tr = T[b.key], d = (tr.test_score - U.score(ref.scores, b.key, 'avg')) * 100;
    return `<button class="tr-item" data-k="${b.key}"><div class="r1"><b>${b.name}</b><span class="mono" style="font-size:13px">${U.pct(tr.test_score)}</span></div>
      <div class="r2"><span>${b.category}</span><span class="${d >= 0 ? 'up' : 'down'}">${U.sgn(d)} vs ref</span></div>${spark(tr)}</button>`;
  }).join('');
  list.querySelectorAll('.tr-item').forEach(el => el.onclick = () => select(el.dataset.k, true));

  const kf = $('.js-kf');
  kf.innerHTML = 'Show: ' + KINDS.map(([k, n]) => `<button class="kbtn k-${k}" data-k="${k}">${n}</button>`).join('');
  kf.querySelectorAll('.kbtn').forEach(b => b.onclick = () => {
    const k = b.dataset.k; hidden.has(k) ? hidden.delete(k) : hidden.add(k); b.classList.toggle('off', hidden.has(k));
    document.querySelectorAll(`.st.${k}`).forEach(el => el.style.display = hidden.has(k) ? 'none' : '');
  });

  function curve(b, tr) {
    const W = 760, H = 220, L = 46, R = 14, Tp = 12, Bt = 34;
    const c = tr.selfcheck, test = tr.test_score;
    const vs = [...c.map(p => p[1]), test];
    const lo = Math.max(0, Math.floor(Math.min(...vs) * 20) / 20 - 0.05), hi = Math.min(1, Math.ceil(Math.max(...vs) * 20) / 20 + 0.02);
    const x1 = 360;
    const sx = t => L + t / x1 * (W - L - R), sy = v => Tp + (1 - (v - lo) / (hi - lo)) * (H - Tp - Bt);
    let g = '';
    const step = (hi - lo) > 0.4 ? 0.1 : 0.05;
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end">${v.toFixed(2)}</text>`;
    for (let t = 0; t <= 360; t += 60) g += `<text x="${sx(t)}" y="${H - Bt + 16}" text-anchor="middle">${t / 60}h</text>`;
    g += `<text x="${W - R}" y="${H - 4}" text-anchor="end">build time →</text><text x="${L}" y="${H - 4}">${b.metric}</text>`;
    g += `<line x1="${L}" x2="${W - R}" y1="${sy(test)}" y2="${sy(test)}" stroke="var(--accent)" stroke-dasharray="5 4"/><text x="${W - R}" y="${sy(test) - 5}" text-anchor="end" style="fill:var(--accent)">hidden test ${U.pct(test)}</text>`;
    g += `<polyline points="${c.map(p => `${sx(p[0])},${sy(p[1])}`).join(' ')}" fill="none" stroke="var(--k-sc)" stroke-width="1.6" opacity=".7"/>`;
    c.forEach(p => g += `<circle data-tip="<b>${U.hmTime(p[0])}</b><br>${U.esc(p[2])}" cx="${sx(p[0])}" cy="${sy(p[1])}" r="4.5" fill="var(--k-sc)" stroke="var(--surface)" stroke-width="1.5"/>`);
    const el = $('.js-curve');
    el.innerHTML = c.length ? `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}</svg>` : '<p class="note">No scored self_check in this trace.</p>';
    U.bindTips(el);
  }

  function select(k, scroll) {
    const b = B.find(x => x.key === k), tr = T[k];
    list.querySelectorAll('.tr-item').forEach(el => el.classList.toggle('on', el.dataset.k === k));
    const refV = U.score(ref.scores, k, 'avg');
    const nSteps = tr.phases.reduce((s, p) => s + p.steps.length, 0);
    $('.js-head').innerHTML = `<h2>${U.esc(tr.title)}</h2><p>${U.esc(tr.caption)}</p>
      <div class="kpis"><div><b>${U.pct(tr.test_score)}</b>hidden test ${b.metric} (5-reader mean)</div>
      <div><b class="${tr.test_score >= refV ? 'up' : 'down'}">${U.sgn((tr.test_score - refV) * 100)}</b>vs Reference RAG ${U.pct(refV)}</div>
      <div><b>${U.hmTime(tr.minutes)}</b>build time</div><div><b>${tr.phases.length}</b>phases · ${nSteps} steps shown</div>
      <div><b>${agent.latency[k].toFixed(2)} s</b>retrieval / question</div></div>`;
    curve(b, tr);
    $('.js-phases').innerHTML = tr.phases.map(p => `<div class="card phase"><div class="phase-h"><span class="t">${U.hmTime(p.t0)}–${U.hmTime(p.t1)}</span><h3>${U.esc(p.title)}</h3></div>
      <div class="steps">${p.steps.map(s => `<div class="st ${s.kind}" ${hidden.has(s.kind) ? 'style="display:none"' : ''}><span class="t">${U.hmTime(s.t)}</span>
        <span class="k k-${s.kind}">${(KINDS.find(x => x[0] === s.kind) || [0, s.kind])[1]}</span><div class="x">${s.kind === 'cmd' ? '$ ' : ''}${U.esc(s.text)}</div></div>`).join('')}</div></div>`).join('');
    try { history.replaceState(null, '', '#' + k); } catch (e) {}
    if (scroll && innerWidth > 860) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const start = location.hash.slice(1);
  select(T[start] ? start : 'hotpotqa', false);
})();
