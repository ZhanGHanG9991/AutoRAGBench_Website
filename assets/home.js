(function () {
  const D = U.D, B = D.benchmarks, R = D.readers;
  const $ = s => document.querySelector(s);
  const ref = D.refs.find(r => r.key === 'ref'), bm25 = D.refs.find(r => r.key === 'bm25'), cb = D.refs.find(r => r.key === 'closed_book');
  const bname = k => B.find(b => b.key === k).name;
  const all = [...D.agents.map(a => ({ key: a.key, name: a.model, sub: a.harness, sc: a.scores, a })), ...D.refs.map(r => ({ key: r.key, name: r.name, sub: 'reference', sc: r.scores, r }))];
  const fill = m => m.a ? U.col(m.a) : (m.key === 'ref' ? 'var(--ref-ink)' : 'var(--ref)');
  const tw = (s, px = 6.6) => s.length * px;   // rough SVG text width

  // greedy label placement around points: right, left, above, below
  function place(items, W, L, H) {
    const boxes = items.map(p => ({ x0: p.cx - p.r, x1: p.cx + p.r, y0: p.cy - p.r, y1: p.cy + p.r }));
    const hit = (b, list) => list.some(o => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
    const placed = [];
    [...items].sort((p, q) => p.cy - q.cy).forEach(p => {
      const w = tw(p.text), h = 12, d = p.r + 4;
      const opts = [[p.cx + d, p.cy + 4, 'start'], [p.cx - d, p.cy + 4, 'end'], [p.cx - w / 2, p.cy - d - 2, 'start'], [p.cx - w / 2, p.cy + d + 11, 'start'],
        [p.cx + d, p.cy - 8, 'start'], [p.cx + d, p.cy + 16, 'start'], [p.cx - d, p.cy - 8, 'end'], [p.cx - d, p.cy + 16, 'end']];
      p.lab = opts[0];
      for (const o of opts) {
        const x0 = o[2] === 'end' ? o[0] - w : o[0], b = { x0, x1: x0 + w, y0: o[1] - h + 2, y1: o[1] + 2 };
        if (b.x1 > W || b.x0 < L || b.y0 < 0 || (H && b.y1 > H)) continue;
        if (!hit(b, placed) && !hit(b, boxes)) { p.lab = o; placed.push(b); break; }
      }
    });
  }

  // ---------------- hero glance ----------------
  U.onRender(() => {
    const rows = [...[...D.agents].sort((x, y) => U.macro(y.scores, 'avg') - U.macro(x.scores, 'avg')).slice(0, 3).map(a => ({ n: a.model, v: U.macro(a.scores, 'avg'), c: a.color_dark })),
      { n: 'Reference RAG', v: U.macro(ref.scores, 'avg'), c: '#9aa6b8' }, { n: 'Naive BM25 RAG', v: U.macro(bm25.scores, 'avg'), c: '#6c788c' }, { n: 'Closed-book', v: U.macro(cb.scores, 'avg'), c: '#4f5b6e' }];
    const el = $('.js-glance');
    el.innerHTML = rows.map(r => `<div class="row"><span>${r.n}</span><div class="track"><div class="fill" style="background:${r.c}" data-w="${r.v / 0.6 * 100}"></div></div><b>${U.pct(r.v)}</b></div>`).join('');
    requestAnimationFrame(() => requestAnimationFrame(() => el.querySelectorAll('.fill').forEach(f => f.style.width = f.dataset.w + '%')));
  });

  // ---------------- main chart ----------------
  let task = 'avg', reader = 'avg', sel = 'gpt61sol_codex';
  const tseg = $('.js-task');
  [['avg', 'Average'], ...B.map(b => [b.key, b.name])].forEach(([k, n]) => {
    const b = document.createElement('button'); b.textContent = n; b.dataset.k = k; if (k === task) b.className = 'on';
    b.onclick = () => { task = k; tseg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.k === k)); renderMain(); renderDetail(); };
    tseg.appendChild(b);
  });
  const rsel = $('.js-reader');
  rsel.innerHTML = `<option value="avg">Mean of all five</option>` + R.map(r => `<option value="${r.key}">${r.name}</option>`).join('');
  rsel.onchange = () => { reader = rsel.value; renderMain(); renderDetail(); renderTable(); };

  function splitName(s, maxc) {
    if (s.length <= maxc) return [s];
    const parts = s.split(/(?<=[ -])/); let best = [s], bd = 1e9;
    for (let i = 1; i < parts.length; i++) { const a = parts.slice(0, i).join('').trim(), b = parts.slice(i).join('').trim(), d = Math.max(a.length, b.length); if (d < bd) { bd = d; best = [a, b]; } }
    return best;
  }
  const short = { 'DeepSeek Harness': 'DSH', 'reference': 'reference' };

  function renderMain() {
    const host = $('.js-main');
    const W = Math.max(740, (host.clientWidth || 760) - 20), H = 400, L = 44, Rm = 10, T = 30, Bm = 74;
    const rows = all.map(m => {
      const v = U.val(m.sc, task, reader);
      const rr = R.map(r => U.val(m.sc, task, r.key));
      return { m, v, lo: Math.min(...rr), hi: Math.max(...rr) };
    }).sort((x, y) => x.v - y.v);
    const top = Math.max(...rows.map(r => reader === 'avg' ? r.hi : r.v)) * 100;
    const ymax = Math.min(100, Math.ceil((top + 6) / 10) * 10);
    const band = (W - L - Rm) / rows.length, bw = Math.min(54, band * 0.64);
    const sy = v => T + (1 - v / ymax) * (H - T - Bm);
    let g = '';
    for (let v = 0; v <= ymax; v += 10) g += `<line class="gridl" x1="${L}" x2="${W - Rm}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${L - 8}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`;
    g += `<text transform="translate(12 ${(T + H - Bm) / 2}) rotate(-90)" text-anchor="middle">${task === 'avg' ? 'Average score (9 tasks)' : bname(task) + ' · ' + B.find(b => b.key === task).metric + ' ×100'}</text>`;
    rows.forEach((r, i) => {
      const cx = L + band * (i + 0.5), x = cx - bw / 2, y = sy(r.v * 100), h = sy(0) - y;
      const on = r.m.key === sel;
      const col = fill(r.m);
      const tip = `<b>${U.esc(r.m.name)}</b> · ${r.m.sub}<br>${task === 'avg' ? 'Average' : bname(task)}: <b>${U.pct(r.v, 2)}</b>` +
        (reader === 'avg' ? `<br>range over answering models: ${U.pct(r.lo)}–${U.pct(r.hi)}` : '') + (r.m.key !== 'ref' ? `<br>vs Reference RAG: ${U.sgn((r.v - U.val(ref.sc || ref.scores, task, reader)) * 100)}` : '');
      g += `<g class="bar" data-k="${r.m.key}" data-tip="${tip.replace(/"/g, '&quot;')}">
        ${on ? `<rect x="${cx - band / 2 + 2}" y="${T - 12}" width="${band - 4}" height="${sy(0) - T + 12}" rx="8" fill="var(--primary-soft)"/>` : ''}
        <rect x="${cx - band / 2}" y="${T - 10}" width="${band}" height="${H - T + 10}" fill="transparent"/>
        <path d="M${x},${sy(0)} V${y + 5} q0,-5 5,-5 H${x + bw - 5} q5,0 5,5 V${sy(0)} Z" fill="${col}" ${r.m.r ? 'opacity=".9"' : ''}/>`;
      if (reader === 'avg') {
        const y0 = sy(r.lo * 100), y1 = sy(r.hi * 100);
        g += `<g stroke="var(--ink)" stroke-width="1.2" opacity=".4"><line x1="${cx}" x2="${cx}" y1="${y0}" y2="${y1}"/><line x1="${cx - 5}" x2="${cx + 5}" y1="${y1}" y2="${y1}"/><line x1="${cx - 5}" x2="${cx + 5}" y1="${y0}" y2="${y0}"/></g>`;
      }
      const ly = (reader === 'avg' ? sy(r.hi * 100) : y) - 8;
      g += `<text class="num" x="${cx}" y="${ly}" text-anchor="middle">${U.pct(r.v)}</text>`;
      const nm = splitName(r.m.name, Math.floor(band / 7.2));
      nm.forEach((s, j) => g += `<text class="lbl" x="${cx}" y="${sy(0) + 18 + j * 14}" text-anchor="middle" ${on ? 'style="fill:var(--primary)"' : ''}>${U.esc(s)}</text>`);
      g += `<text class="sub" x="${cx}" y="${sy(0) + 18 + nm.length * 14}" text-anchor="middle">${band < 90 ? (short[r.m.sub] || r.m.sub) : r.m.sub}</text>`;
      if (on) g += `<path d="M${cx - 6},${H - 4} l6,-7 l6,7 z" fill="var(--primary)"/>`;
      g += `</g>`;
    });
    const rv = U.val(ref.scores, task, reader) * 100;
    g += `<line x1="${L}" x2="${W - Rm}" y1="${sy(rv)}" y2="${sy(rv)}" stroke="var(--ref-ink)" stroke-dasharray="5 4" opacity=".8" pointer-events="none"/>`;
    g += `<text x="${L + 6}" y="${sy(rv) - 6}" style="fill:var(--ref-ink);font-weight:600" pointer-events="none">Reference RAG ${rv.toFixed(1)}</text>`;
    g += `<line class="axisl" x1="${L}" x2="${W - Rm}" y1="${sy(0)}" y2="${sy(0)}"/>`;
    host.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" style="min-width:${W}px">${g}</svg>`;
    host.querySelectorAll('.bar').forEach(el => el.onclick = () => { sel = el.dataset.k; renderMain(); renderDetail(); });
    U.bindTips(host);
    $('.js-hint').textContent = reader === 'avg' ? 'Whiskers span the lowest to highest score across the five answering models. Click a bar for details.' : 'Click a bar for details.';
  }

  function renderDetail() {
    const m = all.find(x => x.key === sel);
    const v = U.val(m.sc, task, reader);
    const order = all.map(x => ({ k: x.key, v: U.val(x.sc, task, reader) })).sort((x, y) => y.v - x.v);
    const rank = order.findIndex(x => x.k === sel) + 1;
    const dr = (v - U.val(ref.scores, task, reader)) * 100, db = (v - U.val(bm25.scores, task, reader)) * 100;
    const rr = R.map(r => U.val(m.sc, task, r.key));
    const lat = m.a ? (task === 'avg' ? U.mean(B.map(b => m.a.latency[b.key])) : m.a.latency[task]) : (task === 'avg' ? m.r.latency_avg : null);
    let chips = `<div class="chip">Rank<b>${rank} / ${all.length}</b></div>`;
    chips += `<div class="chip">Answering-model range<b>${U.pct(Math.min(...rr))}–${U.pct(Math.max(...rr))}</b></div>`;
    if (lat != null) chips += `<div class="chip">Retrieval latency<b>${lat.toFixed(2)} s / q</b></div>`;
    if (m.a) chips += `<div class="chip">API cost, 9 builds<b>~$${m.a.cost}</b></div>`;
    if (m.a && task !== 'avg') chips += `<div class="chip">Generator calls<b>${m.a.calls[task].toFixed(2)} / q</b></div>`;
    const dot = m.a ? `<i class="dot" style="background:${U.col(m.a)};width:14px;height:14px"></i>` : `<i class="dot" style="background:var(--ref);width:14px;height:14px"></i>`;
    const scale = Math.max(...B.map(b => Math.max(U.score(m.sc, b.key, reader), U.score(ref.scores, b.key, reader)))) * 100;
    const mx = Math.ceil(scale / 10) * 10;
    const rows = B.map(b => {
      const s = U.score(m.sc, b.key, reader) * 100, rf = U.score(ref.scores, b.key, reader) * 100, d = s - rf;
      return `<div class="pt-row" style="${b.key === task ? 'font-weight:700' : ''}"><span>${b.name}</span><div class="tr"><i style="width:${s / mx * 100}%;background:${m.a ? U.col(m.a) : 'var(--ref)'}"></i><u style="left:${rf / mx * 100}%" title="Reference RAG ${rf.toFixed(1)}"></u></div>
        <span class="v">${s.toFixed(1)}</span><span class="d ${m.key === 'ref' ? '' : d >= 0 ? 'up' : 'down'}">${m.key === 'ref' ? '' : U.sgn(d)}</span></div>`;
    }).join('');
    const tr = m.key === 'gpt61sol_codex' ? `<p style="margin:16px 0 0"><a href="traces/#${task === 'avg' ? 'hotpotqa' : task}">Browse this agent's build trace${task === 'avg' ? 's' : ' on ' + bname(task)} →</a></p>` : '';
    $('.js-detail').innerHTML = `<div class="who"><div class="h">${dot}<h3>${U.esc(m.name)}</h3></div><div class="harn">${m.a ? m.a.harness : U.esc(m.r.desc)}</div>
      <div class="big"><b>${U.pct(v)}</b>${m.key !== 'ref' ? `<span class="${dr >= 0 ? 'up' : 'down'}">${U.sgn(dr)} vs Reference RAG</span>` : ''}${m.key !== 'bm25' && m.key !== 'closed_book' ? `<span class="${db >= 0 ? 'up' : 'down'}" style="opacity:.75">${U.sgn(db)} vs BM25</span>` : ''}</div>
      <div class="chips">${chips}</div>${tr}</div>
      <div class="pertask"><h4>Per task · ${reader === 'avg' ? 'mean of five answering models' : R.find(r => r.key === reader).name} · tick = Reference RAG</h4>${rows}</div>`;
  }

  function renderTable() {
    const rows = [...all].sort((x, y) => U.macro(y.sc, reader) - U.macro(x.sc, reader));
    const best = B.map(b => Math.max(...D.agents.map(a => U.score(a.scores, b.key, reader))));
    const ranges = B.map(b => { const v = all.map(m => U.score(m.sc, b.key, reader)); return [Math.min(...v), Math.max(...v)]; });
    const av = rows.map(m => U.macro(m.sc, reader)), ar = [Math.min(...av), Math.max(...av)];
    const cats = []; B.forEach(b => { const c = cats[cats.length - 1]; if (c && c.n === b.category) c.k++; else cats.push({ n: b.category, k: 1 }); });
    let h = `<thead><tr class="cat"><th></th><th class="m"></th><th class="avg"></th>${cats.map(c => `<th colspan="${c.k}">${c.n}</th>`).join('')}</tr>
      <tr><th>#</th><th class="m">Method</th><th class="avg">Avg</th>${B.map(b => `<th>${b.name}<br><span style="font-weight:400;color:var(--faint)">${b.metric}</span></th>`).join('')}</tr></thead><tbody>`;
    rows.forEach((m, i) => {
      const a = U.macro(m.sc, reader);
      h += `<tr class="${m.r ? 'reft' : ''}"><td class="rk">${i + 1}</td><td class="m">${m.a ? `<i class="dot" style="background:${U.col(m.a)};margin-right:7px"></i>${m.name} <span style="color:var(--faint);font-size:12px">${m.sub}</span>` : m.name}</td>
        <td class="avg" style="${U.heat(a, ar[0], ar[1])}">${U.pct(a, 2)}</td>${B.map((b, j) => {
          const v = U.score(m.sc, b.key, reader);
          return `<td class="${m.a && v === best[j] ? 'best' : ''}" style="${U.heat(v, ranges[j][0], ranges[j][1])}">${U.pct(v, 2)}</td>`;
        }).join('')}</tr>`;
    });
    $('.js-table').innerHTML = h + '</tbody>';
  }
  U.onRender(() => { renderMain(); renderDetail(); renderTable(); });

  // ---------------- benchmark section ----------------
  $('.js-tasks').innerHTML = `<thead><tr><th>Task</th><th>Category</th><th class="num">Records</th><th class="num">Train</th><th class="num">Test</th><th>Metric</th></tr></thead><tbody>` +
    B.map(b => `<tr><td><span class="bn">${b.name}</span><div class="ds">${b.desc}</div></td><td class="ct">${b.category}</td><td class="num">${b.records.toLocaleString('en-US')}</td><td class="num">${b.train.toLocaleString('en-US')}</td><td class="num">${b.n.toLocaleString('en-US')}</td><td class="mono">${b.metric}</td></tr>`).join('') + '</tbody>';
  U.onRender(() => {
    $('.js-agentpills').innerHTML = D.agents.map(a => `<span class="pill"><i class="dot" style="background:${U.col(a)};width:8px;height:8px;margin-right:6px"></i>${a.model} <span style="color:var(--faint)">· ${a.harness}</span></span>`).join('');
  });
  $('.js-readerpills').innerHTML = ['Gemma-4-E4B', 'Gemma-3-4B', 'Phi-4-mini', 'SmolLM3-3B', 'Llama-3.2-3B'].map(n => `<span class="pill">${n}</span>`).join('') + `<p class="note" style="margin:6px 0 0">Four families, zero-shot, native chat template, temperature 0, ≤ 512 output tokens.</p>`;
  $('.js-refs').innerHTML = D.refs.map(r => `<dt>${r.name}</dt><dd>${r.desc}</dd>`).join('') + `<dt>Human-SOTA</dt><dd>13 recent methods (HippoRAG 2, LightRAG, RAPTOR, SubgraphRAG, HyDE, …) adapted to the same contract.</dd>`;

  // ---------------- Figure A: stability across answering models ----------------
  let focusA = null;
  U.onRender(function renderStab() {
    const rs = [...R].sort((x, y) => U.macro(ref.scores, y.key) - U.macro(ref.scores, x.key));
    const host = $('.js-stab'), W = 520, H = 330, L = 40, Rm = 14, T = 12, Bm = 34;
    const lead = (a, r) => (U.macro(a.scores, r) - U.macro(ref.scores, r)) * 100;
    const vals = D.agents.flatMap(a => rs.map(r => lead(a, r.key)));
    const lo = Math.floor(Math.min(...vals) / 2) * 2 - 1, hi = Math.ceil(Math.max(...vals) / 2) * 2 + 1;
    const sx = i => L + 20 + i * (W - L - Rm - 40) / (rs.length - 1), sy = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - Bm);
    let g = '';
    for (let v = Math.ceil(lo / 4) * 4; v <= hi; v += 4) g += `<line class="gridl" x1="${L}" x2="${W - Rm}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end">${v > 0 ? '+' : ''}${v}</text>`;
    g += `<line x1="${L}" x2="${W - Rm}" y1="${sy(0)}" y2="${sy(0)}" stroke="var(--ref-ink)" stroke-dasharray="5 4"/><text x="${L + 4}" y="${sy(0) + 14}" style="fill:var(--ref-ink)">Reference RAG = 0</text>`;
    rs.forEach((r, i) => g += `<text class="lbl" x="${sx(i)}" y="${H - 12}" text-anchor="middle">${r.name}</text>`);
    D.agents.forEach(a => {
      const f = focusA && focusA !== a.key, c = U.col(a);
      g += `<g opacity="${f ? 0.15 : 1}"><polyline points="${rs.map((r, i) => `${sx(i)},${sy(lead(a, r.key))}`).join(' ')}" fill="none" stroke="${c}" stroke-width="${focusA === a.key ? 3 : 2}"/>` +
        rs.map((r, i) => `<circle data-tip="<b>${a.model}</b> · ${r.name}<br>lead ${U.sgn(lead(a, r.key))} · score ${U.pct(U.macro(a.scores, r.key))}" cx="${sx(i)}" cy="${sy(lead(a, r.key))}" r="4.5" fill="${c}" stroke="var(--surface)" stroke-width="1.5"/>`).join('') + '</g>';
    });
    host.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}</svg>`;
    U.bindTips(host);
    legendAgents('.js-stab-leg', k => { focusA = focusA === k ? null : k; renderStab(); }, k => !focusA || focusA === k);
    const firsts = rs.map(r => [...D.agents].sort((x, y) => U.macro(y.scores, r.key) - U.macro(x.scores, r.key))[0].model);
    const above = rs.map(r => D.agents.filter(a => lead(a, r.key) > 0).length);
    $('.js-t-stab').textContent = `${firsts.every(f => f === firsts[0]) ? firsts[0] + ' ranks first under all five answering models' : 'The leader changes with the answering model'}, and the lines stay nearly parallel. The lead over Reference RAG shifts more: ${Math.min(...above)} to ${Math.max(...above)} of nine configurations beat it, depending on the answering model.`;
  });

  function legendAgents(sel, onClick, isOn) {
    const el = $(sel), groups = {};
    D.agents.forEach(a => (groups[a.harness] = groups[a.harness] || []).push(a));
    el.innerHTML = Object.entries(groups).map(([h, as]) => `<span class="grp">${h}</span>` + as.map(a => `<span class="tog ${isOn(a.key) ? '' : 'off'}" data-k="${a.key}"><i class="dot" style="background:${U.col(a)}"></i>${a.model}</span>`).join('')).join('');
    el.querySelectorAll('.tog').forEach(t => t.onclick = () => onClick(t.dataset.k));
  }

  // ---------------- Figure B: score vs latency ----------------
  U.onRender(() => {
    const host = $('.js-pareto'), W = 520, H = 330, L = 40, Rm = 14, T = 14, Bm = 38;
    const pts = [...D.agents.map(a => ({ n: a.model, x: U.mean(B.map(b => a.latency[b.key])), y: U.macro(a.scores, 'avg') * 100, c: U.col(a), sub: a.harness })),
      ...[bm25, ref].map(r => ({ n: r.name, x: r.latency_avg, y: U.macro(r.scores, 'avg') * 100, c: 'var(--ref-ink)', sub: 'reference', refp: true }))];
    const x1 = 2.25, y0 = 34, y1 = 58;
    const sx = x => L + x / x1 * (W - L - Rm), sy = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - Bm);
    const front = []; let best = -1;
    [...pts].sort((p, q) => p.x - q.x).forEach(p => { if (p.y > best) { front.push(p); best = p.y; } });
    pts.forEach(p => p.front = front.includes(p));
    let stair = `M${sx(front[0].x)},${sy(y0)}`; front.forEach((p, i) => { stair += ` L${sx(p.x)},${sy(i ? front[i - 1].y : y0)} L${sx(p.x)},${sy(p.y)}`; }); stair += ` L${sx(x1)},${sy(front[front.length - 1].y)}`;
    let g = `<path d="${stair} L${sx(x1)},${sy(y0)} Z" fill="var(--primary-soft)"/>`;
    for (let y = 35; y <= y1; y += 5) g += `<line class="gridl" x1="${L}" x2="${W - Rm}" y1="${sy(y)}" y2="${sy(y)}"/><text x="${L - 6}" y="${sy(y) + 4}" text-anchor="end">${y}</text>`;
    for (let x = 0; x <= 2; x += 0.5) g += `<text x="${sx(x)}" y="${H - Bm + 16}" text-anchor="middle">${x}</text>`;
    g += `<text x="${(L + W - Rm) / 2}" y="${H - 4}" text-anchor="middle">Mean retrieval latency (s / question)</text><text transform="translate(11 ${(T + H - Bm) / 2}) rotate(-90)" text-anchor="middle">Average score</text>`;
    g += `<path d="${stair}" fill="none" stroke="var(--ink)" stroke-dasharray="4 3" opacity=".55"/>`;
    const items = pts.map(p => ({ ...p, cx: sx(p.x), cy: sy(p.y), r: 7, text: p.n }));
    place(items, W - Rm, L, H - Bm);
    items.forEach(p => {
      const tip = `<b>${p.n}</b> · ${p.sub}<br>score ${p.y.toFixed(1)} · ${p.x.toFixed(2)} s/q${p.front ? '<br>on the Pareto frontier' : ''}`;
      const mark = p.refp ? `<path d="M${p.cx},${p.cy - 7} l7,7 l-7,7 l-7,-7z" fill="${p.c}"/>` : p.front ? `<circle cx="${p.cx}" cy="${p.cy}" r="6.5" fill="${p.c}" stroke="var(--surface)" stroke-width="1.5"/>` : `<circle cx="${p.cx}" cy="${p.cy}" r="5.5" fill="var(--surface)" stroke="${p.c}" stroke-width="2.2"/>`;
      g += `<g data-tip="${tip}">${mark}<text class="lbl" x="${p.lab[0]}" y="${p.lab[1]}" text-anchor="${p.lab[2]}" style="font-weight:500">${p.n}</text></g>`;
    });
    host.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}</svg>`;
    U.bindTips(host);
    const lats = D.agents.map(a => U.mean(B.map(b => a.latency[b.key])));
    $('.js-t-pareto').textContent = `Every agent-built system is slower than Reference RAG (${ref.latency_avg.toFixed(2)} s): ${Math.min(...lats).toFixed(2)}–${Math.max(...lats).toFixed(2)} s per question. Only Gemini 3.8 Flash and the three Sol models sit on the frontier; DeepSeek V4.1 Flash is the slowest yet scores below five faster agents.`;
  });

  // ---------------- Figure C: gains by task ----------------
  let focusC = null;
  U.onRender(function renderTasks() {
    const host = $('.js-tasks-chart'), W = 1060, rowH = 34, L = 92, Rm = 20, T = 6, H = T + B.length * rowH + 34;
    const d = (sc, b) => (U.score(sc, b, 'avg') - U.score(ref.scores, b, 'avg')) * 100;
    const vals = B.flatMap(b => [...D.agents.map(a => d(a.scores, b.key)), d(bm25.scores, b.key)]);
    const lo = Math.floor(Math.min(...vals) / 5) * 5, hi = Math.ceil(Math.max(...vals) / 5) * 5;
    const sx = v => L + (v - lo) / (hi - lo) * (W - L - Rm);
    let g = '';
    for (let v = lo; v <= hi; v += 5) g += `<line class="gridl" x1="${sx(v)}" x2="${sx(v)}" y1="${T}" y2="${H - 28}" ${v === 0 ? 'style="stroke:var(--ref-ink);stroke-dasharray:4 3"' : ''}/><text x="${sx(v)}" y="${H - 12}" text-anchor="middle">${v > 0 ? '+' : ''}${v}</text>`;
    B.forEach((b, i) => {
      const y = T + i * rowH + rowH / 2;
      if (i % 2) g += `<rect x="${L - 88}" y="${y - rowH / 2}" width="${W - L + 88 - Rm + 10}" height="${rowH}" fill="var(--bg2)" opacity=".5"/>`;
      g += `<text class="lbl" x="${L - 12}" y="${y + 4}" text-anchor="end">${b.name}</text>`;
      const bv = d(bm25.scores, b.key);
      g += `<path data-tip="<b>${b.name}</b> · Naive BM25 RAG<br>${U.sgn(bv)} vs Reference RAG" d="M${sx(bv)},${y - 6} l6,6 l-6,6 l-6,-6z" fill="var(--ref)"/>`;
      const ds = D.agents.map(a => ({ a, v: d(a.scores, b.key) })).sort((p, q) => p.v - q.v);
      ds.forEach((p, j) => {
        const near = j > 0 && Math.abs(sx(p.v) - sx(ds[j - 1].v)) < 9; p.off = near ? (ds[j - 1].off === 0 ? -6 : 0) : 0;
        if (near && ds[j - 1].off === -6) p.off = 6;
        const f = focusC && focusC !== p.a.key;
        g += `<circle data-tip="<b>${p.a.model}</b> · ${b.name}<br>${(U.score(p.a.scores, b.key, 'avg') * 100).toFixed(1)} (${U.sgn(p.v)} vs Reference RAG)" cx="${sx(p.v)}" cy="${y + p.off}" r="${focusC === p.a.key ? 7 : 5.5}" fill="${U.col(p.a)}" stroke="var(--surface)" stroke-width="1.2" opacity="${f ? 0.15 : 0.95}"/>`;
      });
    });
    g += `<text x="${sx(0) + 6}" y="${H - 28}" style="fill:var(--ref-ink)">Reference RAG</text>`;
    host.innerHTML = `<div class="scroll-x"><svg class="chart" viewBox="0 0 ${W} ${H}" style="min-width:640px">${g}</svg></div>`;
    U.bindTips(host);
    legendAgents('.js-tasks-leg', k => { focusC = focusC === k ? null : k; renderTasks(); }, k => !focusC || focusC === k);
    const allBeat = B.filter(b => D.agents.every(a => d(a.scores, b.key) > 0)).map(b => b.name);
    $('.js-t-tasks').textContent = `The best agent leads Reference RAG by 27.3 points on CWQ, 21.6 on WebQSP and 13.0 on HotpotQA, but by at most 1.5 on NQ and FEVER. All nine agents beat it on ${allBeat.join(', ')}; on FEVER seven of nine fall below it.`;
  });

  // ---------------- Figure D: strategies ----------------
  U.onRender(() => {
    const order = ['nq_open', 'hotpotqa', 'musique', 'multihop_rag', 'pubmedqa', 'qasper', 'fever', 'webqsp', 'cwq'];
    const colors = { 'Pre-retrieval': '44, 85, 240', 'Retrieval': '18, 137, 90', 'Post-retrieval': '214, 106, 30' };
    let h = `<thead><tr><th></th><th></th>${order.map(k => `<th>${bname(k)}</th>`).join('')}<th>Share</th></tr></thead><tbody>`;
    D.strategy.forEach(st => {
      const n = st.groups.reduce((s, g) => s + 1 + g.rows.length, 0); let first = true;
      st.groups.forEach(g => {
        h += `<tr>${first ? `<td class="s" rowspan="${n}" style="background:rgb(${colors[st.stage]})">${st.stage}</td>` : ''}<td class="g" colspan="${order.length + 2}">${g.name}<small>${g.kind === 'multi' ? 'multi' : 'single'}</small></td></tr>`;
        first = false;
        g.rows.forEach(r => {
          h += `<tr><td class="n">${r.name}</td>${order.map(k => { const c = r.counts[k];
            return `<td class="c" data-tip="<b>${r.name}</b> · ${bname(k)}<br>${c} of 9 agents" style="background:rgba(${colors[st.stage]}, ${c ? (0.08 + c / 9 * 0.72).toFixed(2) : 0.04});color:${c >= 6 ? '#fff' : 'var(--ink)'}">${c || '·'}</td>`; }).join('')}<td class="sh">${Math.round(r.share * 100)}%</td></tr>`;
        });
      });
    });
    $('.js-strat').innerHTML = h + '</tbody>';
    U.bindTips($('.js-strat'));
  });

  // ---------------- Figure E: iteration curves ----------------
  const iterOn = new Set(['gpt61sol_codex', 'gpt6sol_codex', 'sol_codex', 'luna_codex']);
  U.onRender(function renderIter() {
    legendAgents('.js-iter-leg', k => { iterOn.has(k) ? iterOn.delete(k) : iterOn.add(k); renderIter(); }, k => iterOn.has(k));
    const W = 330, H = 190, L = 32, Rm = 8, T = 8, Bm = 22;
    const host = $('.js-iter');
    host.innerHTML = B.map(b => {
      const runs = D.agents.filter(a => iterOn.has(a.key) && D.iteration[a.key] && D.iteration[a.key][b.key]).map(a => ({ a, r: D.iteration[a.key][b.key] }));
      const ys = runs.flatMap(x => x.r.pts.map(p => p[1]));
      let lo = Math.min(0, ...ys), hi = Math.max(1, ...ys); const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
      const step = [1, 2, 4, 5, 8, 10, 20].find(s => (hi - lo) / s <= 5) || 20;
      const sx = h => L + h / 6 * (W - L - Rm), sy = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - Bm);
      let g = '';
      for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) g += `<line class="gridl" x1="${L}" x2="${W - Rm}" y1="${sy(v)}" y2="${sy(v)}" ${v === 0 ? 'style="stroke:var(--line2)"' : ''}/><text x="${L - 5}" y="${sy(v) + 4}" text-anchor="end">${v > 0 ? '+' : ''}${v}</text>`;
      for (let h = 0; h <= 6; h += 2) g += `<text x="${sx(h)}" y="${H - 6}" text-anchor="middle">${h}h</text>`;
      runs.forEach(({ a, r }) => {
        const c = U.col(a);
        g += `<polyline points="${r.pts.map(p => `${sx(p[0])},${sy(p[1])}`).join(' ')}" fill="none" stroke="${c}" stroke-width="1.8" opacity=".9"/>`;
        g += r.pts.map(p => `<circle data-tip="<b>${a.model}</b> · ${b.name}<br>${p[0].toFixed(2)} h · gain ${U.sgn(p[1])}<br>first version ${r.first} on ${r.n} dev questions" cx="${sx(p[0])}" cy="${sy(p[1])}" r="2.6" fill="${c}"/>`).join('');
        const bp = r.pts.reduce((q, p) => Math.abs(p[0] - r.best_h) < Math.abs(q[0] - r.best_h) ? p : q, r.pts[0]);
        const cx = sx(bp[0]), cy = sy(bp[1]), s = 7;
        const star = Array.from({ length: 10 }, (_, i) => { const ang = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? s * 0.45 : s; return `${(cx + rr * Math.cos(ang)).toFixed(1)},${(cy + rr * Math.sin(ang)).toFixed(1)}`; }).join(' ');
        g += `<polygon data-tip="<b>${a.model}</b> · ${b.name}<br>first reaches its best at ${r.best_h.toFixed(1)} h (net gain ${U.sgn(r.net)}${r.below ? ', ends ' + r.below + ' below best' : ''})" points="${star}" fill="${c}" stroke="var(--surface)" stroke-width="1"/>`;
      });
      return `<div class="sm"><h5>${b.name}</h5><svg class="chart" viewBox="0 0 ${W} ${H}">${g}</svg></div>`;
    }).join('');
    U.bindTips(host);
  });

  // ---------------- Figure F: development activity ----------------
  U.onRender(() => {
    const A = D.activity, cls = A.classes, cvar = c => `var(--act-${c.toLowerCase()})`;
    $('.js-act-leg').innerHTML = cls.map((c, i) => `<span><i class="dot" style="background:${cvar(c)};border-radius:3px"></i>${c}</span>`).join('') +
      `<span class="note" style="margin-left:6px">Prepare: inspect inputs · Code: edit · Run: build jobs · Test: run evaluations · Analyze: examine results</span>`;
    const names = { gpt61sol_codex: 'GPT-6.1 Sol', gpt6sol_codex: 'GPT-6 Sol', sol_codex: 'GPT-5.6 Sol', luna_codex: 'GPT-5.6 Luna' };
    const tokMax = Math.ceil(Math.max(...Object.values(A.agents).flatMap(a => a.tokens[0].map((_, j) => a.tokens.reduce((s, r) => s + r[j], 0)))) / 20) * 20;
    const area = (M, ymax, unit, name) => {
      const W = 420, H = 96, n = M[0].length, w = W / n;
      const sx = j => j * w + w / 2, sy = v => H - v / ymax * (H - 4);
      let g = '', base = new Array(n).fill(0);
      for (let v = ymax / 2; v <= ymax; v += ymax / 2) g += `<line class="gridl" x1="0" x2="${W}" y1="${sy(v)}" y2="${sy(v)}"/>`;
      cls.forEach((c, k) => {
        const top = base.map((b, j) => b + M[k][j]);
        const xs = [0, ...Array.from({ length: n }, (_, j) => sx(j)), W];
        const tp = [top[0], ...top, top[n - 1]], bp = [base[0], ...base, base[n - 1]];
        g += `<path d="M${xs.map((x, j) => `${x.toFixed(1)},${sy(tp[j]).toFixed(1)}`).join(' L')} L${xs.map((x, j) => j).reverse().map(j => `${xs[j].toFixed(1)},${sy(bp[j]).toFixed(1)}`).join(' L')} Z" fill="${cvar(c)}" stroke="var(--surface)" stroke-width=".4"/>`;
        base = top;
      });
      for (let j = 0; j < n; j++) {
        const tip = `<b>${name}</b> · ${(j * 0.25).toFixed(2)}–${((j + 1) * 0.25).toFixed(2)} h<br>` + cls.map((c, k) => `${c}: ${M[k][j].toFixed(unit === '%' ? 0 : 1)}${unit}`).join('<br>');
        g += `<rect data-tip="${tip}" x="${j * w}" y="0" width="${w}" height="${H}" fill="transparent"/>`;
      }
      g += `<line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="var(--line2)"/>`;
      return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:96px">${g}</svg>`;
    };
    let h = `<div class="hd first"></div><div class="hd">Build time (share)</div><div class="hd">Output tokens (thousands per hour, 0–${tokMax})</div>`;
    Object.entries(A.agents).forEach(([k, a]) => {
      h += `<div class="nm"><b>${names[k]}</b><span>${a.rounds} rounds · ${a.tokens_median_k}K tokens<br>Test+Analyze ${(a.overall_time[3] + a.overall_time[4]).toFixed(0)}% of time</span></div>${area(a.time, 100, '%', names[k])}${area(a.tokens, tokMax, 'K/h', names[k])}`;
    });
    h += `<div></div><div class="note" style="display:flex;justify-content:space-between"><span>0 h</span><span>build hour</span><span>5.75 h</span></div><div class="note" style="display:flex;justify-content:space-between"><span>0 h</span><span>build hour</span><span>5.75 h</span></div>`;
    $('.js-act').innerHTML = h;
    U.bindTips($('.js-act'));
  });

  // ---------------- Figure G: improving Human-SOTA ----------------
  U.onRender(() => {
    const G = D.human, host = $('.js-human'), W = 520, rowH = 44, L = 84, Rm = 40, T = 6, H = T + G.tasks.length * rowH + 28;
    const cD = U.col(U.agent('deepseek_dsh')), cG = U.col(U.agent('gpt61sol_codex'));
    const sx = v => L + (v - 15) / (85 - 15) * (W - L - Rm);
    let g = '';
    for (let v = 20; v <= 80; v += 20) g += `<line class="gridl" x1="${sx(v)}" x2="${sx(v)}" y1="${T}" y2="${H - 24}"/><text x="${sx(v)}" y="${H - 8}" text-anchor="middle">${v}</text>`;
    G.tasks.forEach((t, i) => {
      const y = T + i * rowH, s = G.start[t], d = G.dsh[t], q = G.g61[t], rf = G.ref[t];
      g += `<text class="lbl" x="${L - 10}" y="${y + rowH / 2 + 4}" text-anchor="end">${bname(t)}</text>`;
      g += `<rect x="${sx(s)}" y="${y + 9}" width="${sx(d) - sx(s)}" height="11" rx="3" fill="${cD}" opacity=".3"/><rect x="${sx(s)}" y="${y + 23}" width="${sx(q) - sx(s)}" height="11" rx="3" fill="${cG}" opacity=".3"/>`;
      g += `<line x1="${sx(rf)}" x2="${sx(rf)}" y1="${y + 5}" y2="${y + 38}" stroke="var(--ink)" stroke-width="1.5" opacity=".45" data-tip="Reference RAG · ${bname(t)}: ${rf.toFixed(1)}"/>`;
      g += `<path data-tip="<b>DeepSeek V4.1 Flash</b> · ${bname(t)}<br>${s.toFixed(1)} → ${d.toFixed(1)} (${U.sgn(d - s)})" d="M${sx(d) - 6},${y + 9} h12 l-6,10 z" fill="${cD}"/>`;
      g += `<circle data-tip="<b>GPT-6.1 Sol</b> · ${bname(t)}<br>${s.toFixed(1)} → ${q.toFixed(1)} (${U.sgn(q - s)})" cx="${sx(q)}" cy="${y + 28.5}" r="6" fill="${cG}"/>`;
      const halo = 'paint-order:stroke;stroke:var(--surface);stroke-width:3px;stroke-linejoin:round';
      g += `<text class="num" x="${sx(d) + 9}" y="${y + 18}" style="font-weight:500;font-size:11px;${halo}">${U.sgn(d - s)}</text><text class="num" x="${sx(q) + 10}" y="${y + 32}" style="font-size:11px;${halo}">${U.sgn(q - s)}</text>`;
      g += `<circle data-tip="<b>${G.method[t]}${t === 'hotpotqa' ? '*' : ''}</b> start package · ${bname(t)}: ${s.toFixed(1)}" cx="${sx(s)}" cy="${y + 21.5}" r="6" fill="var(--surface)" stroke="var(--ref-ink)" stroke-width="2"/>`;
      const mt = G.method[t] + (t === 'hotpotqa' ? '*' : ''), fits = sx(s) - 10 - tw(mt, 5.6) > L + 4;
      g += fits ? `<text x="${sx(s) - 10}" y="${y + 25}" text-anchor="end" class="sub" style="${halo}">${mt}</text>`
        : `<text x="${sx(s) - 4}" y="${y + 45}" class="sub" style="${halo}">${mt}</text>`;
    });
    host.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}</svg>`;
    U.bindTips(host);
    $('.js-human-leg').innerHTML = `<span><i class="dot" style="background:var(--surface);border:2px solid var(--ref-ink)"></i>Human-SOTA start</span><span><i class="dot" style="background:${cD}"></i>DeepSeek V4.1 Flash</span><span><i class="dot" style="background:${cG}"></i>GPT-6.1 Sol</span><span><i style="width:2px;height:12px;background:var(--ink);opacity:.45;display:inline-block"></i>Reference RAG</span>`;
    const gG = G.tasks.map(t => G.g61[t] - G.start[t]), gD = G.tasks.map(t => G.dsh[t] - G.start[t]);
    $('.js-t-human').textContent = `Starting from a human-designed method on seven tasks, GPT-6.1 Sol gains ${U.mean(gG).toFixed(1)} points on average (${Math.min(...gG).toFixed(1)}–${Math.max(...gG).toFixed(1)}) and DeepSeek V4.1 Flash ${U.mean(gD).toFixed(1)}. No starting package beats Reference RAG; after six hours GPT-6.1 Sol does on all seven tasks.`;
  });

  // ---------------- Figure H: automated RAG frameworks ----------------
  U.onRender(() => {
    const F = D.frameworks, host = $('.js-fw'), W = 520, H = 330, L = 36, Rm = 8, T = 18, Bm = 34;
    const series = [['autorag', 'Agentic AutoRAG', U.dark() ? '#f5a15a' : '#e8762c'], ['flashrag', 'FlashRAG', U.dark() ? '#c08af0' : '#8b3fc2'], ['g61', 'GPT-6.1 Sol (from scratch)', U.col(U.agent('gpt61sol_codex'))]];
    const sy = v => T + (1 - v / 90) * (H - T - Bm), band = (W - L - Rm) / F.tasks.length, bw = band * 0.24;
    let g = '';
    for (let v = 0; v <= 90; v += 15) g += `<line class="gridl" x1="${L}" x2="${W - Rm}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`;
    F.tasks.forEach((t, i) => {
      const x0 = L + i * band + band * 0.14;
      series.forEach(([k, n, c], j) => {
        const v = F[k][t], x = x0 + j * bw;
        if (v == null) { const cx = x + bw / 2 - 1, cy = sy(4); g += `<g data-tip="<b>${n}</b> · ${bname(t)}<br>no system: index construction exceeded 6 h"><path d="M${cx - 5},${cy - 5} l10,10 M${cx + 5},${cy - 5} l-10,10" stroke="var(--neg)" stroke-width="2.4"/></g>`; return; }
        g += `<rect data-tip="<b>${n}</b> · ${bname(t)}<br>${v.toFixed(1)}${k !== 'g61' ? ` (${U.sgn(v - F.g61[t])} vs GPT-6.1 Sol)` : ''}" x="${x}" y="${sy(v)}" width="${bw - 2}" height="${sy(0) - sy(v)}" rx="2.5" fill="${c}" opacity="${k === 'g61' ? 1 : 0.85}"/>`;
      });
      const rf = D.human.ref[t];
      g += `<line data-tip="Reference RAG · ${bname(t)}: ${rf.toFixed(1)}" x1="${x0 - 3}" x2="${x0 + 3 * bw + 1}" y1="${sy(rf)}" y2="${sy(rf)}" stroke="var(--ink)" stroke-width="1.6" stroke-dasharray="3 2" opacity=".6"/>`;
      g += `<text class="lbl" x="${x0 + 1.5 * bw}" y="${H - 14}" text-anchor="middle" style="font-size:11px">${bname(t)}</text>`;
    });
    g += `<line class="axisl" x1="${L}" x2="${W - Rm}" y1="${sy(0)}" y2="${sy(0)}"/>`;
    host.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}</svg>`;
    U.bindTips(host);
    $('.js-fw-leg').innerHTML = series.map(([k, n, c]) => `<span><i class="dot" style="background:${c};border-radius:3px"></i>${n}</span>`).join('') + `<span><i style="width:14px;border-top:2px dashed var(--ink);opacity:.6;display:inline-block"></i>Reference RAG</span>`;
    const gaps = F.tasks.flatMap(t => ['autorag', 'flashrag'].filter(k => F[k][t] != null).map(k => F.g61[t] - F[k][t]));
    $('.js-t-fw').textContent = `Neither framework beats the agent on any task: the gap runs from ${Math.min(...gaps).toFixed(1)} points on QASPER to ${Math.max(...gaps).toFixed(1)} on the knowledge-graph tasks, where neither framework's search space includes graph traversal. On the six tasks both complete, the frameworks average about Reference RAG level.`;
  });
})();
