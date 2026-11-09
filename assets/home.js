(function () {
  const D = U.D, B = D.benchmarks, R = D.readers;
  let reader = 'avg';
  const ref = D.refs.find(r => r.key === 'ref');
  const bm25 = D.refs.find(r => r.key === 'bm25');
  const $ = s => document.querySelector(s);

  // ---------- reader selector ----------
  const seg = $('.js-reader');
  [['avg', 'All 5 (mean)'], ...R.map(r => [r.key, r.name])].forEach(([k, n]) => {
    const b = document.createElement('button');
    b.textContent = n; b.dataset.k = k; if (k === reader) b.className = 'on';
    b.onclick = () => { reader = k; seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.k === k)); renderAll(); };
    seg.appendChild(b);
  });

  // ---------- leaderboard ----------
  function renderLB() {
    const rows = [
      ...D.agents.map(a => ({ a, s: U.macro(a.scores, reader) })),
      ...D.refs.map(r => ({ r, s: U.macro(r.scores, reader) }))
    ].sort((x, y) => y.s - x.s);
    const refS = U.macro(ref.scores, reader);
    const max = Math.max(...rows.map(x => x.s)) * 1.08;
    let rank = 0, html = `<div class="lb-row lb-head"><div>Rank</div><div>Method</div><div class="bar-h">Score</div><div style="text-align:right">Avg</div><div></div></div>`;
    rows.forEach((x, i) => {
      if (x.a) {
        rank++;
        const d = (x.s - refS) * 100;
        html += `<div class="lb-row" data-i="${i}"><div class="rank">${rank}</div>
          <div class="who"><b>${x.a.model}</b><small><i class="dot" style="background:${U.fam(x.a.family)}"></i>${x.a.harness}</small></div>
          <div class="bar"><i style="width:${x.s / max * 100}%;background:${U.fam(x.a.family)}"></i><span class="tick" style="left:${refS / max * 100}%"></span></div>
          <div class="score">${U.pct(x.s)}<small class="${d >= 0 ? 'up' : 'down'}">${U.sgn(d)}</small></div><div class="chev">▶</div></div>
          <div class="lb-detail" data-d="${i}"><div class="mini">${B.map(b => {
            const v = U.score(x.a.scores, b.key, reader), dv = (v - U.score(ref.scores, b.key, reader)) * 100;
            return `<div><span>${b.name}</span><b>${U.pct(v)}</b><span class="${dv >= 0 ? 'up' : 'down'}">${U.sgn(dv)}</span></div>`;
          }).join('')}</div></div>`;
      } else {
        html += `<div class="lb-row ref"><div class="rank">–</div>
          <div class="who"><b>${x.r.name}</b><small>${x.r.key === 'ref' ? 'Reference · expert pipeline' : x.r.key === 'bm25' ? 'Baseline · no agent' : 'No retrieval'}</small></div>
          <div class="bar"><i style="width:${x.s / max * 100}%;background:var(--ref);opacity:.45"></i></div>
          <div class="score">${U.pct(x.s)}</div><div></div></div>`;
      }
    });
    const lb = $('.js-lb');
    lb.innerHTML = html;
    lb.querySelectorAll('.lb-row[data-i]').forEach(row => row.onclick = () => {
      row.classList.toggle('open');
      lb.querySelector(`[data-d="${row.dataset.i}"]`).classList.toggle('open');
    });
  }

  // ---------- heat table ----------
  function renderHeat() {
    const agents = [...D.agents].sort((a, b) => U.macro(b.scores, reader) - U.macro(a.scores, reader));
    const refs = [...D.refs].reverse();
    const cats = [];
    B.forEach(b => { const c = cats[cats.length - 1]; if (c && c.name === b.category) c.n++; else cats.push({ name: b.category, n: 1 }); });
    const col = b => agents.map(a => U.score(a.scores, b.key, reader));
    const ranges = B.map(b => { const v = [...col(b), U.score(ref.scores, b.key, reader)]; return [Math.min(...v), Math.max(...v)]; });
    const avgs = [...agents, ref].map(m => U.macro(m.scores, reader));
    const ar = [Math.min(...avgs), Math.max(...avgs)];
    const best = B.map(b => Math.max(...col(b)));
    let h = `<thead><tr class="cat"><th class="m"></th><th class="avg"></th>${cats.map(c => `<th colspan="${c.n}">${c.name}</th>`).join('')}</tr>
      <tr><th class="m">Method</th><th class="avg">Avg</th>${B.map(b => `<th>${b.name}<br><span style="font-weight:400;color:var(--faint)">${b.metric}</span></th>`).join('')}</tr></thead><tbody>`;
    const row = (m, name, cls) => {
      const av = U.macro(m.scores, reader);
      return `<tr class="${cls}"><td class="m">${name}</td><td class="avg" style="${U.heat(av, ar[0], ar[1])}">${U.pct(av)}</td>${B.map((b, j) => {
        const v = U.score(m.scores, b.key, reader);
        const isBest = cls === '' && v === best[j];
        return `<td class="${isBest ? 'best' : ''}" style="${U.heat(v, ranges[j][0], ranges[j][1])}">${U.pct(v)}</td>`;
      }).join('')}</tr>`;
    };
    agents.forEach(a => h += row(a, `<i class="dot" style="background:${U.fam(a.family)};margin-right:6px"></i>${a.model} <span style="color:var(--faint);font-size:12px">${a.harness}</span>`, ''));
    refs.forEach((r, i) => h += row(r, r.name, 'reft' + (i === 0 ? ' sep' : '')));
    $('.js-heat').innerHTML = h + '</tbody>';
  }

  // ---------- scatter ----------
  function renderScatter() {
    const W = 460, H = 320, L = 44, Rr = 16, T = 14, Bt = 40;
    const pts = D.agents.map(a => ({ a, x: U.mean(B.map(b => a.latency[b.key])), y: U.macro(a.scores, reader) * 100 }));
    const refY = U.macro(ref.scores, reader) * 100;
    const ys = [...pts.map(p => p.y), refY];
    const y0 = Math.floor(Math.min(...ys) / 2) * 2 - 2, y1 = Math.ceil(Math.max(...ys) / 2) * 2 + 2;
    const x0 = 0, x1 = Math.ceil(Math.max(...pts.map(p => p.x)) * 2) / 2 + 0.25;
    const sx = x => L + (x - x0) / (x1 - x0) * (W - L - Rr), sy = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - Bt);
    let g = '';
    for (let y = y0; y <= y1; y += 2) g += `<line class="grid" x1="${L}" x2="${W - Rr}" y1="${sy(y)}" y2="${sy(y)}"/><text x="${L - 6}" y="${sy(y) + 4}" text-anchor="end">${y}</text>`;
    for (let x = 0; x <= x1; x += 0.5) g += `<text x="${sx(x)}" y="${H - Bt + 16}" text-anchor="middle">${x.toFixed(1)}</text>`;
    g += `<text x="${(L + W - Rr) / 2}" y="${H - 6}" text-anchor="middle">retrieval latency (s / question) →</text>`;
    g += `<text transform="translate(12 ${(T + H - Bt) / 2}) rotate(-90)" text-anchor="middle">score</text>`;
    g += `<line x1="${L}" x2="${W - Rr}" y1="${sy(refY)}" y2="${sy(refY)}" stroke="var(--ref)" stroke-dasharray="5 4"/><text x="${W - Rr}" y="${sy(refY) - 5}" text-anchor="end">Reference RAG ${refY.toFixed(1)}</text>`;
    // Pareto frontier: faster and better
    const sorted = [...pts].sort((p, q) => p.x - q.x); const front = []; let bestY = -1;
    sorted.forEach(p => { if (p.y > bestY) { front.push(p); bestY = p.y; } });
    g += `<polyline points="${front.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="2 3" opacity=".7"/>`;
    // greedy label placement: right, left, above, below — first spot that clears placed labels and dots
    const boxes = pts.map(p => ({ x0: sx(p.x) - 6, x1: sx(p.x) + 6, y0: sy(p.y) - 6, y1: sy(p.y) + 6 }));
    const hit = (b, list) => list.some(o => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
    const placed = [];
    [...pts].sort((p, q) => q.y - p.y).forEach(p => {
      const cx = sx(p.x), cy = sy(p.y), w = p.a.model.length * 6.3, h = 12;
      const opts = [[cx + 9, cy + 4, 'start'], [cx - 9, cy + 4, 'end'], [cx - w / 2, cy - 10, 'start'], [cx - w / 2, cy + 18, 'start']];
      let pick = opts[0];
      for (const o of opts) {
        const x0 = o[2] === 'end' ? o[0] - w : o[0], b = { x0, x1: x0 + w, y0: o[1] - h + 2, y1: o[1] + 2 };
        if (b.x1 > W || b.x0 < L) continue;
        if (!hit(b, placed) && !hit(b, boxes)) { pick = o; placed.push(b); break; }
      }
      p.lab = pick;
    });
    pts.forEach(p => {
      g += `<g data-tip="<b>${p.a.model}</b> · ${p.a.harness}<br>score ${p.y.toFixed(1)} · ${p.x.toFixed(2)} s/q">
        <circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="6" fill="${U.fam(p.a.family)}" stroke="var(--surface)" stroke-width="1.5"/>
        <text class="lbl" x="${p.lab[0]}" y="${p.lab[1]}" text-anchor="${p.lab[2]}">${p.a.model}</text></g>`;
    });
    const el = $('.js-scatter');
    el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}</svg>`;
    U.bindTips(el);
    const fams = [...new Set(D.agents.map(a => a.family))];
    $('.js-legend').innerHTML = fams.map(f => `<span><i class="dot" style="background:${U.fam(f)}"></i>${f}</span>`).join('') +
      `<span><svg width="22" height="6"><line x1="0" x2="22" y1="3" y2="3" stroke="var(--accent)" stroke-dasharray="2 3"/></svg>Pareto frontier</span>`;
  }

  // ---------- gain dot plot ----------
  function benchStats(r) {
    return B.map(b => {
      const refV = U.score(ref.scores, b.key, r) * 100;
      const vs = D.agents.map(a => ({ a, v: U.score(a.scores, b.key, r) * 100 })).sort((x, y) => y.v - x.v);
      return { b, refV, best: vs[0], median: vs[4].v, bm25: U.score(bm25.scores, b.key, r) * 100, beat: vs.filter(x => x.v > refV).length };
    });
  }
  function renderGain() {
    const st = benchStats(reader);
    const W = 460, rowH = 30, L = 96, Rr = 16, T = 8, H = T + st.length * rowH + 30;
    const all = st.flatMap(s => [s.best.v - s.refV, s.median - s.refV, s.bm25 - s.refV]);
    const lo = Math.floor(Math.min(...all) / 10) * 10, hi = Math.ceil(Math.max(...all) / 10) * 10;
    const sx = v => L + (v - lo) / (hi - lo) * (W - L - Rr);
    let g = '';
    for (let v = lo; v <= hi; v += 10) g += `<line class="grid" x1="${sx(v)}" x2="${sx(v)}" y1="${T}" y2="${H - 26}" ${v === 0 ? 'stroke="var(--faint)"' : ''}/><text x="${sx(v)}" y="${H - 10}" text-anchor="middle">${v > 0 ? '+' : ''}${v}</text>`;
    st.forEach((s, i) => {
      const y = T + i * rowH + rowH / 2;
      const d = [s.best.v - s.refV, s.median - s.refV, s.bm25 - s.refV];
      g += `<text class="lbl" x="${L - 10}" y="${y + 4}" text-anchor="end">${s.b.name}</text>`;
      g += `<line x1="${sx(Math.min(...d))}" x2="${sx(Math.max(...d))}" y1="${y}" y2="${y}" stroke="var(--border)" stroke-width="3"/>`;
      g += `<circle data-tip="<b>${s.b.name}</b> · BM25 RAG<br>${s.bm25.toFixed(1)} (${U.sgn(d[2])} vs ref)" cx="${sx(d[2])}" cy="${y}" r="5" fill="var(--ref)"/>`;
      g += `<circle data-tip="<b>${s.b.name}</b> · median agent<br>${s.median.toFixed(1)} (${U.sgn(d[1])} vs ref)" cx="${sx(d[1])}" cy="${y}" r="5.5" fill="var(--c-google)"/>`;
      g += `<circle data-tip="<b>${s.b.name}</b> · best: ${s.best.a.model}<br>${s.best.v.toFixed(1)} (${U.sgn(d[0])} vs ref ${s.refV.toFixed(1)})" cx="${sx(d[0])}" cy="${y}" r="6.5" fill="var(--accent)"/>`;
    });
    const el = $('.js-gain');
    el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}</svg>`;
    U.bindTips(el);
  }

  // ---------- benchmarks ----------
  $('.js-bench').innerHTML = B.map(b => `<div class="card bench"><div class="top"><h4>${b.name}</h4><span class="cat">${b.category}</span></div>
    <p>${b.desc}</p><div class="meta">${b.metric} · ${b.n.toLocaleString()} hidden test questions</div></div>`).join('');

  // ---------- observations ----------
  document.querySelectorAll('.js-tabs button').forEach(btn => btn.onclick = () => {
    document.querySelectorAll('.js-tabs button').forEach(x => x.classList.toggle('on', x === btn));
    document.querySelectorAll('.obs').forEach(o => o.classList.toggle('on', o.id === btn.dataset.t));
  });

  function renderObs() {
    // o1: best agent vs references under every reader
    const bestA = [...D.agents].sort((a, b) => U.macro(b.scores, 'avg') - U.macro(a.scores, 'avg'))[0];
    const beat = D.agents.filter(a => U.macro(a.scores, 'avg') > U.macro(ref.scores, 'avg')).length;
    const allReaders = D.agents.filter(a => R.every(r => U.macro(a.scores, r.key) > U.macro(ref.scores, r.key))).length;
    $('.js-o1').innerHTML = `Averaged over the five readers, ${beat} of ${D.agents.length} agents score above Reference RAG (${U.pct(U.macro(ref.scores, 'avg'))}), and ${allReaders} do so under every single reader. The best, ${bestA.model} in ${bestA.harness}, reaches ${U.pct(U.macro(bestA.scores, 'avg'))} — ${U.sgn((U.macro(bestA.scores, 'avg') - U.macro(ref.scores, 'avg')) * 100)} points — after a single 6-hour build per task. Closed-book shows how much of each score retrieval actually contributes.`;
    const series = [{ n: bestA.model, sc: bestA.scores, c: 'var(--accent)' }, { n: 'Reference RAG', sc: ref.scores, c: 'var(--c-zhipu)' },
      { n: 'BM25 RAG', sc: bm25.scores, c: 'var(--ref)' }, { n: 'Closed-book', sc: D.refs.find(r => r.key === 'closed_book').scores, c: 'var(--border)' }];
    const W = 760, H = 250, L = 34, T = 10, Bt = 44, gw = (W - L) / R.length, bw = gw / (series.length + 1.4);
    const sy = v => T + (1 - v / 70) * (H - T - Bt);
    let g = '';
    for (let v = 0; v <= 70; v += 10) g += `<line class="grid" x1="${L}" x2="${W}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`;
    R.forEach((r, i) => {
      const x0 = L + i * gw + bw * 0.7;
      series.forEach((s, j) => {
        const v = U.macro(s.sc, r.key) * 100;
        g += `<rect data-tip="<b>${r.name}</b><br>${s.n}: ${v.toFixed(1)}" x="${x0 + j * bw}" y="${sy(v)}" width="${bw - 3}" height="${sy(0) - sy(v)}" rx="3" fill="${s.c}"/>`;
      });
      g += `<text class="lbl" x="${L + i * gw + gw / 2}" y="${H - Bt + 18}" text-anchor="middle">${r.name}</text>`;
    });
    $('.js-o1chart').innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}</svg><div class="legend">${series.map(s => `<span><i class="dot" style="background:${s.c}"></i>${s.n}</span>`).join('')}</div>`;
    U.bindTips($('.js-o1chart'));

    // o2: per-benchmark gains
    const st = benchStats('avg');
    const kg = st.filter(s => s.b.category === 'KGQA'), flat = st.filter(s => ['nq_open', 'fever'].includes(s.b.key));
    $('.js-o2').innerHTML = `The best agent's margin over Reference RAG ranges from ${U.sgn(Math.min(...st.map(s => s.best.v - s.refV)))} to ${U.sgn(Math.max(...st.map(s => s.best.v - s.refV)))} points. The largest gains are on the knowledge-graph tasks (${kg.map(s => s.b.name).join(', ')}), where the best agent gains ${kg.map(s => U.sgn(s.best.v - s.refV)).join(' and ')} points, the median agent ${kg.map(s => U.sgn(s.median - s.refV)).join(' and ')}, and ${kg.map(s => `${s.beat}`).join(' and ')} of ${D.agents.length} agents beat the reference. On ${flat.map(s => s.b.name).join(' and ')} the best agent gains under 2 points and the median agent is close to the reference.`;
    let h = `<thead><tr><th class="m">Benchmark</th><th>Reference RAG</th><th>Median agent</th><th>Best agent</th><th>Best − Ref</th><th>Median − Ref</th><th>Agents &gt; Ref</th></tr></thead><tbody>`;
    const gains = st.map(s => s.best.v - s.refV);
    st.forEach(s => {
      const gb = s.best.v - s.refV, gm = s.median - s.refV;
      h += `<tr><td class="m">${s.b.name} <span style="color:var(--faint);font-size:12px">${s.b.category}</span></td><td>${s.refV.toFixed(1)}</td><td>${s.median.toFixed(1)}</td>
        <td>${s.best.v.toFixed(1)} <span style="color:var(--faint);font-family:var(--sans);font-size:11px">${s.best.a.model}</span></td>
        <td class="${gb >= 0 ? 'up' : 'down'}" style="${U.heat(gb, Math.min(...gains), Math.max(...gains))}">${U.sgn(gb)}</td>
        <td class="${gm >= 0 ? 'up' : 'down'}">${U.sgn(gm)}</td><td>${s.beat} / ${D.agents.length}</td></tr>`;
    });
    $('.js-o2tbl').innerHTML = h + '</tbody>';

    // o3: ranks per reader
    const ranks = {};
    R.forEach(r => { const order = [...D.agents].sort((a, b) => U.macro(b.scores, r.key) - U.macro(a.scores, r.key)); order.forEach((a, i) => (ranks[a.key] = ranks[a.key] || {})[r.key] = i + 1); });
    const tau = (r1, r2) => { let c = 0, d = 0; const ks = D.agents.map(a => a.key);
      for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const s = (ranks[ks[i]][r1] - ranks[ks[j]][r1]) * (ranks[ks[i]][r2] - ranks[ks[j]][r2]); s > 0 ? c++ : d++; }
      return (c - d) / (c + d); };
    const taus = []; for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) taus.push(tau(R[i].key, R[j].key));
    const top3 = R.map(r => D.agents.filter(a => ranks[a.key][r.key] <= 3).map(a => a.key).sort().join()).every((v, _, arr) => v === arr[0]);
    $('.js-o3').innerHTML = `The five readers differ widely in absolute accuracy, yet they order the agents almost identically: pairwise Kendall τ between reader rankings is ${Math.min(...taus).toFixed(2)}–${Math.max(...taus).toFixed(2)} (mean ${U.mean(taus).toFixed(2)})${top3 ? ', and the top three are the same under every reader' : ''}. The benchmark therefore measures transferable retrieval quality, not tuning to one reader.`;
    const order = [...D.agents].sort((a, b) => U.macro(b.scores, 'avg') - U.macro(a.scores, 'avg'));
    h = `<thead><tr><th class="m">Agent</th>${R.map(r => `<th>${r.name}</th>`).join('')}</tr></thead><tbody>`;
    order.forEach(a => {
      h += `<tr><td class="m"><i class="dot" style="background:${U.fam(a.family)};margin-right:6px"></i>${a.model}</td>${R.map(r => {
        const k = ranks[a.key][r.key]; return `<td style="${U.heat(10 - k, 1, 9)}" data-tip="${a.model} · ${r.name}<br>score ${U.pct(U.macro(a.scores, r.key))}">#${k}</td>`;
      }).join('')}</tr>`;
    });
    $('.js-o3tbl').innerHTML = h + '</tbody>';
    U.bindTips($('.js-o3tbl'));
  }

  // o4: strategy matrix (static)
  (function renderStrat() {
    const order = ['nq_open', 'hotpotqa', 'musique', 'multihop_rag', 'pubmedqa', 'qasper', 'fever', 'webqsp', 'cwq'];
    const name = k => B.find(b => b.key === k).name;
    const colors = { 'Pre-retrieval': '58, 100, 200', 'Retrieval': '35, 130, 80', 'Post-retrieval': '196, 110, 18' };
    let h = `<thead><tr><th></th><th></th>${order.map(k => `<th>${name(k)}</th>`).join('')}<th>Share</th></tr></thead><tbody>`;
    D.strategy.forEach(st => {
      const n = st.groups.reduce((s, g) => s + 1 + g.rows.length, 0);
      let first = true;
      st.groups.forEach(g => {
        h += `<tr>${first ? `<td class="s" rowspan="${n}" style="background:rgb(${colors[st.stage]})">${st.stage}</td>` : ''}<td class="g" colspan="${order.length + 2}">${g.name}<small>${g.kind === 'multi' ? 'multi-select' : 'single'}</small></td></tr>`;
        first = false;
        g.rows.forEach(r => {
          h += `<tr><td class="n">${r.name}</td>${order.map(k => { const c = r.counts[k];
            return `<td class="c" style="background:rgba(${colors[st.stage]}, ${c ? (0.1 + c / 9 * 0.75).toFixed(2) : 0.04});color:${c >= 6 ? '#fff' : 'var(--text)'}">${c || '·'}</td>`; }).join('')}<td class="sh">${Math.round(r.share * 100)}%</td></tr>`;
        });
      });
    });
    $('.js-strat').innerHTML = h + '</tbody>';
  })();

  // ---------- citation copy ----------
  $('.js-copy').onclick = e => {
    navigator.clipboard.writeText($('.js-bib').textContent).then(() => { e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy', 1500); });
  };

  function renderAll() { renderLB(); renderHeat(); renderScatter(); renderGain(); }
  renderAll(); renderObs();
})();
