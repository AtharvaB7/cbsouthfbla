/* CB South FBLA Test Bank — static single-page app. No build step.
   Data: data/events.json (catalog) + data/q/<event-id>.json (questions, loaded on demand). */
(function () {
  'use strict';
  const CFG = Object.assign({ repo: '', chapter: 'CB South FBLA' }, window.CBS_CONFIG || {});
  const LETTERS = 'ABCDE';
  const app = document.getElementById('app');

  // ---------- storage (per-browser progress) ----------
  const STORE_KEY = 'cbsfbla:v1';
  let store = { stats: {}, theme: null };
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) store = Object.assign(store, JSON.parse(raw)); } catch (e) { }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { } }
  function record(ev, qid, correct) {
    const k = ev + ':' + qid;
    const s = store.stats[k] || [0, 0, 0];
    s[0]++; if (correct) s[1]++; s[2] = correct ? 1 : 0;
    store.stats[k] = s; save();
  }
  function statOf(ev, qid) { return store.stats[ev + ':' + qid]; }

  // ---------- theme ----------
  function applyTheme() {
    if (store.theme) document.documentElement.setAttribute('data-theme', store.theme);
    else document.documentElement.removeAttribute('data-theme');
  }
  applyTheme();

  // ---------- helpers ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => n.toLocaleString('en-US');
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function h(html) { app.innerHTML = html; window.scrollTo(0, 0); }
  function reportLink(ev, q) {
    if (!CFG.repo) return '';
    const title = encodeURIComponent(`Question issue: ${ev.name} #${q.id}`);
    const body = encodeURIComponent(`Event: ${ev.name}\nQuestion ID: ${q.id}\n\nQuestion: ${q.q}\n\nWhat's wrong?\n`);
    return `<a class="report" target="_blank" rel="noopener" href="${CFG.repo}/issues/new?title=${title}&body=${body}">Report a problem</a>`;
  }

  // ---------- data ----------
  let catalog = null;
  const cache = {};
  async function loadCatalog() {
    if (catalog) return catalog;
    const r = await fetch('data/events.json');
    catalog = await r.json();
    return catalog;
  }
  async function loadEvent(id) {
    if (cache[id]) return cache[id];
    const r = await fetch('data/q/' + id + '.json');
    if (!r.ok) throw new Error('missing');
    cache[id] = await r.json();
    return cache[id];
  }

  // ---------- state ----------
  const st = {
    ev: null, data: null,
    topics: new Set(), past: true, practice: true, onlyMissed: false, onlyNew: false, order: 'shuffle', count: 25,
    run: null
  };

  function pool() {
    const d = st.data; if (!d) return [];
    return d.questions.filter(q => {
      if (st.topics.size && !st.topics.has(q.t)) return false;
      if (q.k === 'p' && !st.practice) return false;
      if (q.k !== 'p' && !st.past) return false;
      const s = statOf(st.ev.id, q.id);
      if (st.onlyMissed && !(s && s[2] === 0)) return false;
      if (st.onlyNew && s) return false;
      return true;
    });
  }

  // ---------- home ----------
  let homeFilter = 'all', homeSearch = '';
  function evProgress(ev) {
    let seen = 0, right = 0;
    const pre = ev.id + ':';
    for (const k in store.stats) if (k.startsWith(pre)) { seen++; if (store.stats[k][2] === 1) right++; }
    return { seen, right };
  }
  function renderHome() {
    const c = catalog;
    const total = c.events.reduce((a, e) => a + e.count, 0);
    const current = c.events.filter(e => !e.legacy);
    const withQ = current.filter(e => e.count > 0).length;
    h(`
      <section class="intro">
        <div class="eyebrow">${esc(CFG.chapter)} · 2026–27 season</div>
        <h1>Objective test prep for every FBLA event</h1>
        <p class="lede">A free question bank for ${esc(CFG.chapter)} members. It pulls together past FBLA district, state, and national study-guide tests plus practice questions written to the official 2026–27 study guides, sorted by event and by the topics FBLA actually tests.</p>
        <ol class="steps">
          <li><b>Pick your event.</b> Every event with an objective test is here, including the test portion of role-play events.</li>
          <li><b>Choose topics.</b> Study one knowledge area at a time, or leave them all on.</li>
          <li><b>Pick a mode.</b> Quiz for instant feedback, flashcards to memorize, a timed test to simulate competition, or browse everything.</li>
        </ol>
        <div class="statline"><span><strong>${fmt(total)}</strong> questions</span><span><strong>${withQ}</strong> of ${current.length} current events covered</span><span>Progress saves in this browser</span><span>Updated <strong>${esc(c.updated)}</strong></span></div>
      </section>
      <div class="toolbar">
        <input id="evsearch" class="search" type="search" placeholder="Search events (e.g. accounting, cyber, parli)" value="${esc(homeSearch)}" aria-label="Search events">
        <div class="seg" role="group" aria-label="Filter events">
          ${[['all', 'All'], ['test', 'Objective tests'], ['rp', 'Role play tests'], ['legacy', 'Retired']].map(([k, l]) => `<button data-f="${k}" aria-pressed="${homeFilter === k}">${l}</button>`).join('')}
        </div>
      </div>
      <div id="groups"></div>
      ${footer()}
    `);
    const groupsEl = document.getElementById('groups');
    function drawList() {
      const q = homeSearch.trim().toLowerCase();
      const match = e => !q || e.name.toLowerCase().includes(q) || e.topics.some(t => t.name.toLowerCase().includes(q));
      const groups = [
        ['test', 'Objective test events', '100 multiple-choice questions, 50 minutes.', e => !e.legacy && !e.roleplay],
        ['rp', 'Role play & presentation events with a test', 'The objective test decides who advances to the role play or presentation round.', e => !e.legacy && e.roleplay],
        ['legacy', 'Retired events', 'No longer competed, but their questions overlap current events. Good extra practice.', e => e.legacy],
      ];
      let html = '';
      for (const [k, title, sub, f] of groups) {
        if (homeFilter !== 'all' && homeFilter !== k) continue;
        const list = c.events.filter(f).filter(match);
        if (!list.length) continue;
        html += `<section class="group"><h2>${title} <small>${list.length}</small></h2><p>${sub}</p><ul class="evlist">` +
          list.map(e => {
            const p = evProgress(e);
            const pct = e.count ? Math.round(100 * p.right / e.count) : 0;
            return `<li><a class="evrow" href="#e-${e.id}">
              <span class="nm">${esc(e.name)}</span>
              <span class="meta">${e.topics.filter(t => t.items).length || e.topics.length} topics${p.seen ? ` · ${p.seen} practiced` : ''}</span>
              <span class="cnt">${e.count ? fmt(e.count) : '<span class="muted">coming soon</span>'}<small>${e.count ? 'questions' : ''}</small>${p.seen ? `<span class="bar" title="${pct}% answered correctly"><i style="width:${pct}%"></i></span>` : ''}</span>
            </a></li>`;
          }).join('') + `</ul></section>`;
      }
      groupsEl.innerHTML = html || `<p class="empty">No events match “${esc(homeSearch)}”.</p>`;
    }
    drawList();
    const s = document.getElementById('evsearch');
    s.addEventListener('input', () => { homeSearch = s.value; drawList(); });
    app.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
      homeFilter = b.dataset.f;
      app.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', x === b));
      drawList();
    }));
  }

  function footer() {
    return `<footer class="foot">
      <div>Built by ${esc(CFG.chapter)} for chapter study. Not an official FBLA product. Official sample questions are in FBLA Connect.</div>
      <div>Questions marked <span class="pill">past test</span> come from past FBLA tests and study guides. Questions marked <span class="pill gold">practice</span> were written for this site from the 2026–27 study-guide objectives.${CFG.repo ? ` Spot an error? <a href="${CFG.repo}/issues" target="_blank" rel="noopener">Tell us</a>.` : ''}</div>
    </footer>`;
  }

  // ---------- event setup ----------
  async function openEvent(id) {
    await loadCatalog();
    const ev = catalog.events.find(e => e.id === id);
    if (!ev) { location.hash = ''; return; }
    if (!st.ev || st.ev.id !== id) {
      st.ev = ev; st.topics = new Set(); st.onlyMissed = false; st.onlyNew = false; st.run = null;
      app.innerHTML = '<p class="loading">Loading questions…</p>';
      try { st.data = await loadEvent(id); } catch (e) { st.data = { topics: [], questions: [] }; }
    }
    renderEvent();
  }

  function renderEvent() {
    const ev = st.ev, d = st.data;
    const p = evProgress(ev);
    const missed = d.questions.filter(q => { const s = statOf(ev.id, q.id); return s && s[2] === 0; }).length;
    const totalItems = ev.topics.reduce((a, t) => a + (t.items || 0), 0);
    h(`
      <a class="back" href="#">← All events</a>
      <section class="evhead">
        <div class="eyebrow">${ev.legacy ? 'Retired event' : ev.roleplay ? 'Objective test + ' + (ev.category === 'Role Play' ? 'role play' : 'presentation') : 'Objective test event'}</div>
        <h1>${esc(ev.name)}</h1>
        ${ev.desc ? `<p class="lede">${esc(ev.desc)}</p>` : ''}
        ${ev.note ? `<p class="note">${esc(ev.note)}</p>` : ''}
        <div class="facts">
          <span><strong>${fmt(d.questions.length)}</strong> questions</span>
          <span><strong>${fmt(ev.past)}</strong> from past tests</span>
          <span><strong>${fmt(ev.practice)}</strong> practice</span>
          ${ev.legacy ? '' : '<span>Real test: <strong>100 Qs · 50 min</strong></span>'}
          ${p.seen ? `<span>You: <strong>${p.right}</strong> right of <strong>${p.seen}</strong> tried</span>` : ''}
        </div>
      </section>
      ${d.questions.length ? `
      <section class="panel">
        <h3>Topics ${totalItems ? '<span class="muted" style="font-weight:400;font-size:.85rem">official test weight in items</span>' : ''} <button class="linkish" id="alltopics">${st.topics.size ? 'Select all' : ''}</button></h3>
        <div class="chips" id="chips">
          ${d.topics.map((t, i) => {
            const meta = ev.topics[i] || {};
            const n = d.questions.filter(q => q.t === i).length;
            if (!n) return '';
            return `<button class="chip" data-t="${i}" aria-pressed="${st.topics.has(i)}">${esc(t)} <span class="n">${n}${meta.items ? ' · ' + meta.items + ' on test' : ''}</span></button>`;
          }).join('')}
        </div>
        <div class="opts">
          <label><input type="checkbox" id="opast" ${st.past ? 'checked' : ''}> Past-test questions</label>
          <label><input type="checkbox" id="oprac" ${st.practice ? 'checked' : ''}> Practice questions</label>
          <label><input type="checkbox" id="omiss" ${st.onlyMissed ? 'checked' : ''}> Only ones I missed (${missed})</label>
          <label><input type="checkbox" id="onew" ${st.onlyNew ? 'checked' : ''}> Only ones I haven't tried</label>
          <label>Order <select id="oorder"><option value="shuffle" ${st.order === 'shuffle' ? 'selected' : ''}>Shuffled</option><option value="seq" ${st.order === 'seq' ? 'selected' : ''}>By topic</option></select></label>
          <label>Quiz / test length <select id="ocount">${[10, 25, 50, 100].map(n => `<option value="${n}" ${st.count === n ? 'selected' : ''}>${n}</option>`).join('')}<option value="0" ${st.count === 0 ? 'selected' : ''}>All</option></select></label>
        </div>
        <div class="selcount" id="selcount"></div>
      </section>
      <div class="modes">
        <button class="mode primary" data-m="quiz"><b>Quiz</b><span>One at a time, see the answer right away.</span></button>
        <button class="mode" data-m="cards"><b>Flashcards</b><span>Flip to check yourself. Sort into got it / still learning.</span></button>
        <button class="mode" data-m="test"><b>Test</b><span>Timed like the real thing, ${ev.legacy ? '' : 'weighted by official topics, '}scored at the end.</span></button>
        <button class="mode" data-m="browse"><b>Browse all</b><span>Every question and answer, searchable.</span></button>
      </div>` : `<section class="panel"><h3>Questions coming soon</h3><p class="muted" style="margin:0">We're still building the bank for this event. Check the official study guide in the 2026–27 Competitive Events Guidelines and FBLA Connect in the meantime.</p></section>`}
      ${footer()}
    `);
    if (!d.questions.length) return;
    const upd = () => {
      const n = pool().length;
      document.getElementById('selcount').innerHTML = `<strong>${fmt(n)}</strong> questions match your filters.`;
      app.querySelectorAll('.mode').forEach(b => b.disabled = n === 0);
      const at = document.getElementById('alltopics'); at.textContent = st.topics.size ? 'Select all' : '';
    };
    upd();
    app.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      const t = +b.dataset.t; st.topics.has(t) ? st.topics.delete(t) : st.topics.add(t);
      b.setAttribute('aria-pressed', st.topics.has(t)); upd();
    }));
    document.getElementById('alltopics').addEventListener('click', () => { st.topics.clear(); app.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', 'false')); upd(); });
    const bind = (id, fn) => document.getElementById(id).addEventListener('change', e => { fn(e.target); upd(); });
    bind('opast', el => st.past = el.checked);
    bind('oprac', el => st.practice = el.checked);
    bind('omiss', el => { st.onlyMissed = el.checked; if (el.checked) { st.onlyNew = false; document.getElementById('onew').checked = false; } });
    bind('onew', el => { st.onlyNew = el.checked; if (el.checked) { st.onlyMissed = false; document.getElementById('omiss').checked = false; } });
    bind('oorder', el => st.order = el.value);
    bind('ocount', el => st.count = +el.value);
    app.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => start(b.dataset.m)));
  }

  function pick(list, n, weighted) {
    const want = n && n < list.length ? n : list.length;
    if (st.order === 'seq') return list.slice(0, want);
    if (!weighted || st.topics.size || want === list.length) return shuffle(list).slice(0, want);
    // allocate by official item weights so a test feels like the real blueprint
    const items = st.ev.topics.map(t => t.items || 0);
    const tot = items.reduce((a, b) => a + b, 0);
    if (!tot) return shuffle(list).slice(0, want);
    const byT = {}; list.forEach(q => (byT[q.t] = byT[q.t] || []).push(q));
    let out = [];
    items.forEach((w, i) => { if (!w || !byT[i]) return; const k = Math.round(want * w / tot); out = out.concat(shuffle(byT[i]).slice(0, k)); });
    const used = new Set(out.map(q => q.id));
    out = out.concat(shuffle(list.filter(q => !used.has(q.id))).slice(0, Math.max(0, want - out.length)));
    return shuffle(out.slice(0, want));
  }

  function start(mode) {
    const list = pool();
    if (!list.length) return;
    if (mode === 'browse') { st.run = { mode, list: st.order === 'seq' ? list : list.slice(), shown: 40, query: '', reveal: false }; return renderBrowse(); }
    if (mode === 'cards') { st.run = { mode, list: pick(list, 0), i: 0, flipped: false, known: 0, learning: 0, missed: [] }; return renderCard(); }
    if (mode === 'quiz') { st.run = { mode, list: pick(list, st.count), i: 0, picked: null, right: 0, done: 0 }; return renderQuiz(); }
    if (mode === 'test') {
      const qs = pick(list, st.count || 100, true);
      st.run = { mode, list: qs, i: 0, ans: {}, flags: new Set(), secs: Math.round(qs.length * 30), started: Date.now(), over: false };
      return renderTest();
    }
  }

  function topicName(q) { return st.data.topics[q.t] || ''; }
  function tagPills(q) {
    return `<span class="pill ${q.k === 'p' ? 'gold' : ''}">${q.k === 'p' ? 'practice' : 'past test'}</span><span>${esc(topicName(q))}</span><span class="muted">· ${esc(q.s || '')}</span>`;
  }
  function exitRun() { st.run = null; stopTimer(); renderEvent(); }

  // ---------- quiz ----------
  function renderQuiz() {
    const r = st.run, q = r.list[r.i];
    if (!q) return renderQuizDone();
    const answered = r.picked !== null;
    h(`
      <div class="runbar"><button class="back" id="exit" style="margin:0">← ${esc(st.ev.name)}</button><span class="title"></span>
        <span class="mono">${r.i + 1} / ${r.list.length}</span><span class="mono muted">${r.right} correct</span></div>
      <div class="progress"><i style="width:${100 * r.i / r.list.length}%"></i></div>
      <article class="qcard">
        <div class="qmeta">${tagPills(q)}</div>
        <p class="qtext">${esc(q.q)}</p>
        <ul class="choices">
          ${q.o.map((o, i) => {
            let cls = '';
            if (answered) { if (i === q.a) cls = 'right'; else if (i === r.picked) cls = 'wrong'; }
            return `<li><button class="choice ${cls}" data-i="${i}" ${answered ? 'disabled' : ''}><span class="L">${LETTERS[i]}</span><span>${esc(o)}</span></button></li>`;
          }).join('')}
        </ul>
        ${answered ? `<div class="feedback ${r.picked === q.a ? 'good' : 'bad'}"><b>${r.picked === q.a ? 'Correct.' : 'Not quite. The answer is ' + LETTERS[q.a] + '.'}</b>${q.x ? esc(q.x) : ''}</div>` : ''}
        <div class="actions">
          ${answered ? `<button class="btn primary" id="next">${r.i + 1 < r.list.length ? 'Next question' : 'See results'}</button><span class="kbd">Enter ↵</span>` : `<span class="kbd">Press A–${LETTERS[q.o.length - 1]} or 1–${q.o.length}</span>`}
          ${reportLink(st.ev, q)}
        </div>
      </article>`);
    document.getElementById('exit').onclick = exitRun;
    app.querySelectorAll('.choice').forEach(b => b.addEventListener('click', () => answerQuiz(+b.dataset.i)));
    const n = document.getElementById('next'); if (n) { n.onclick = nextQuiz; n.focus(); }
  }
  function answerQuiz(i) {
    const r = st.run, q = r.list[r.i]; if (r.picked !== null) return;
    r.picked = i; r.done++; if (i === q.a) r.right++;
    record(st.ev.id, q.id, i === q.a); renderQuiz();
  }
  function nextQuiz() { const r = st.run; r.i++; r.picked = null; renderQuiz(); }
  function renderQuizDone() {
    const r = st.run, pct = r.done ? Math.round(100 * r.right / r.done) : 0;
    h(`<button class="back" id="exit">← ${esc(st.ev.name)}</button>
      <div class="eyebrow">Quiz complete</div>
      <div class="score"><span class="big">${pct}%</span><span class="mono">${r.right} of ${r.done} correct</span></div>
      <div class="actions"><button class="btn primary" id="again">New quiz</button><button class="btn" id="miss">Practice what I missed</button></div>`);
    document.getElementById('exit').onclick = exitRun;
    document.getElementById('again').onclick = () => start('quiz');
    document.getElementById('miss').onclick = () => { st.onlyMissed = true; st.onlyNew = false; if (pool().length) start('quiz'); else exitRun(); };
  }

  // ---------- flashcards ----------
  function renderCard() {
    const r = st.run, q = r.list[r.i];
    if (!q) {
      h(`<button class="back" id="exit">← ${esc(st.ev.name)}</button>
        <div class="eyebrow">Deck finished</div>
        <div class="score"><span class="big">${r.known}</span><span class="mono">got it · ${r.learning} still learning</span></div>
        <div class="actions"><button class="btn primary" id="again">Shuffle and restart</button>${r.missed.length ? `<button class="btn" id="redo">Redo the ${r.missed.length} I'm still learning</button>` : ''}</div>`);
      document.getElementById('exit').onclick = exitRun;
      document.getElementById('again').onclick = () => start('cards');
      const rd = document.getElementById('redo'); if (rd) rd.onclick = () => { st.run = { mode: 'cards', list: shuffle(r.missed), i: 0, flipped: false, known: 0, learning: 0, missed: [] }; renderCard(); };
      return;
    }
    h(`
      <div class="runbar"><button class="back" id="exit" style="margin:0">← ${esc(st.ev.name)}</button><span class="title"></span>
        <span class="mono">${r.i + 1} / ${r.list.length}</span><span class="mono muted">${r.known} got it · ${r.learning} learning</span></div>
      <div class="progress"><i style="width:${100 * r.i / r.list.length}%"></i></div>
      <article class="flash" id="flash" tabindex="0" aria-live="polite">
        <div class="qmeta">${tagPills(q)}</div>
        ${r.flipped ? `
          <div class="side">Answer</div>
          <div class="ans">${LETTERS[q.a]}. ${esc(q.o[q.a])}</div>
          <p class="muted" style="margin:0">${esc(q.q)}</p>
          ${q.x ? `<p style="margin:0">${esc(q.x)}</p>` : ''}
        ` : `
          <div class="side">Question</div>
          <p class="qtext" style="margin:0">${esc(q.q)}</p>
          <ul class="front-opts">${q.o.map((o, i) => `<li>${LETTERS[i]}. ${esc(o)}</li>`).join('')}</ul>
          <div class="hint">Tap the card or press Space to flip</div>`}
      </article>
      <div class="actions">
        ${r.flipped ? `<button class="btn bad" id="learn">Still learning</button><button class="btn good" id="know">Got it</button><span class="kbd">← / →</span>` : `<button class="btn primary" id="flip">Show answer</button>`}
        ${reportLink(st.ev, q)}
      </div>`);
    document.getElementById('exit').onclick = exitRun;
    document.getElementById('flash').onclick = flipCard;
    const f = document.getElementById('flip'); if (f) f.onclick = flipCard;
    const k = document.getElementById('know'); if (k) k.onclick = () => gradeCard(true);
    const l = document.getElementById('learn'); if (l) l.onclick = () => gradeCard(false);
  }
  function flipCard() { st.run.flipped = !st.run.flipped; renderCard(); }
  function gradeCard(ok) {
    const r = st.run, q = r.list[r.i];
    if (ok) r.known++; else { r.learning++; r.missed.push(q); }
    record(st.ev.id, q.id, ok); r.i++; r.flipped = false; renderCard();
  }

  // ---------- test ----------
  let timerId = null;
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
  function timeLeft() { const r = st.run; return Math.max(0, r.secs - Math.floor((Date.now() - r.started) / 1000)); }
  function mmss(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  function renderTest() {
    const r = st.run, q = r.list[r.i];
    const nDone = Object.keys(r.ans).length;
    h(`
      <div class="runbar"><button class="back" id="exit" style="margin:0">← Quit test</button><span class="title"></span>
        <span class="mono muted">${nDone} / ${r.list.length} answered</span><span class="timer" id="timer">${mmss(timeLeft())}</span></div>
      <div class="progress"><i style="width:${100 * nDone / r.list.length}%"></i></div>
      <article class="qcard">
        <div class="qmeta"><span class="mono">Question ${r.i + 1}</span></div>
        <p class="qtext">${esc(q.q)}</p>
        <ul class="choices">${q.o.map((o, i) => `<li><button class="choice ${r.ans[q.id] === i ? 'sel' : ''}" data-i="${i}"><span class="L">${LETTERS[i]}</span><span>${esc(o)}</span></button></li>`).join('')}</ul>
        <div class="actions">
          <button class="btn" id="prev" ${r.i === 0 ? 'disabled' : ''}>Previous</button>
          <button class="btn" id="next" ${r.i + 1 >= r.list.length ? 'disabled' : ''}>Next</button>
          <button class="btn" id="flag">${r.flags.has(q.id) ? 'Unflag' : 'Flag for review'}</button>
          <button class="btn primary" id="submit" style="margin-left:auto">Submit test</button>
        </div>
        <div class="navgrid" aria-label="Jump to question">${r.list.map((x, i) => `<button data-j="${i}" class="${r.ans[x.id] !== undefined ? 'done' : ''} ${i === r.i ? 'cur' : ''} ${r.flags.has(x.id) ? 'flag' : ''}">${i + 1}</button>`).join('')}</div>
        <div id="confirm"></div>
      </article>`);
    document.getElementById('exit').onclick = () => { stopTimer(); exitRun(); };
    app.querySelectorAll('.choice').forEach(b => b.addEventListener('click', () => { r.ans[q.id] = +b.dataset.i; if (r.i + 1 < r.list.length) r.i++; renderTest(); }));
    document.getElementById('prev').onclick = () => { r.i--; renderTest(); };
    document.getElementById('next').onclick = () => { r.i++; renderTest(); };
    document.getElementById('flag').onclick = () => { r.flags.has(q.id) ? r.flags.delete(q.id) : r.flags.add(q.id); renderTest(); };
    app.querySelectorAll('.navgrid button').forEach(b => b.addEventListener('click', () => { r.i = +b.dataset.j; renderTest(); }));
    document.getElementById('submit').onclick = () => {
      const left = r.list.length - Object.keys(r.ans).length;
      if (!left) return finishTest();
      document.getElementById('confirm').innerHTML = `<div class="feedback bad"><b>${left} question${left > 1 ? 's are' : ' is'} unanswered.</b>Unanswered questions count as wrong.<div class="actions"><button class="btn primary" id="yes">Submit anyway</button><button class="btn" id="no">Keep working</button></div></div>`;
      document.getElementById('yes').onclick = finishTest;
      document.getElementById('no').onclick = () => document.getElementById('confirm').innerHTML = '';
    };
    stopTimer();
    timerId = setInterval(() => {
      const el = document.getElementById('timer'); const s = timeLeft();
      if (el) { el.textContent = mmss(s); el.classList.toggle('low', s < 120); }
      if (s <= 0) finishTest();
    }, 1000);
  }
  function finishTest() {
    const r = st.run; if (r.over) return; r.over = true; stopTimer();
    r.used = Math.min(r.secs, Math.floor((Date.now() - r.started) / 1000));
    r.list.forEach(q => { if (r.ans[q.id] !== undefined) record(st.ev.id, q.id, r.ans[q.id] === q.a); });
    renderResults(false);
  }
  function renderResults(onlyWrong) {
    const r = st.run;
    const right = r.list.filter(q => r.ans[q.id] === q.a).length;
    const pct = Math.round(100 * right / r.list.length);
    const byT = {};
    r.list.forEach(q => { const t = byT[q.t] = byT[q.t] || [0, 0]; t[1]++; if (r.ans[q.id] === q.a) t[0]++; });
    const rows = Object.keys(byT).map(Number).sort((a, b) => byT[a][0] / byT[a][1] - byT[b][0] / byT[b][1]);
    const review = r.list.map((q, i) => ({ q, i })).filter(({ q }) => !onlyWrong || r.ans[q.id] !== q.a);
    h(`<button class="back" id="exit">← ${esc(st.ev.name)}</button>
      <div class="eyebrow">Test results</div>
      <div class="score"><span class="big">${pct}%</span><span class="mono">${right} of ${r.list.length} correct</span><span class="mono muted">time ${mmss(r.used)} of ${mmss(r.secs)}</span></div>
      <section class="panel"><h3>By topic <span class="muted" style="font-weight:400;font-size:.85rem">weakest first</span></h3>
        <div class="tbl-wrap"><table class="topics"><thead><tr><th>Topic</th><th style="text-align:right">Score</th><th style="width:30%"></th></tr></thead><tbody>
        ${rows.map(t => { const [a, b] = byT[t]; return `<tr><td>${esc(st.data.topics[t])}</td><td class="num">${a}/${b}</td><td><div class="hbar"><i style="width:${Math.round(100 * a / b)}%"></i></div></td></tr>`; }).join('')}
        </tbody></table></div></section>
      <div class="actions"><button class="btn primary" id="again">Take another test</button><button class="btn" id="tog">${onlyWrong ? 'Show all questions' : 'Show only missed'}</button></div>
      <h2 style="margin:24px 0 12px">Review</h2>
      <div class="blist">${review.map(({ q, i }) => {
        const mine = r.ans[q.id];
        return `<div class="bq show"><div class="qmeta"><span class="mono">Q${i + 1}</span> ${tagPills(q)}</div><p class="qtext">${esc(q.q)}</p>
          <ol>${q.o.map((o, j) => `<li class="${j === q.a ? 'ok' : ''}" ${j === mine && j !== q.a ? 'style="background:var(--bad-bg)"' : ''}><span class="L">${LETTERS[j]}</span><span>${esc(o)}${j === mine ? ' <span class="pill">your answer</span>' : ''}</span></li>`).join('')}</ol>
          ${mine === undefined ? '<div class="x">Not answered.</div>' : ''}${q.x ? `<div class="x">${esc(q.x)}</div>` : ''}</div>`;
      }).join('')}</div>`);
    document.getElementById('exit').onclick = exitRun;
    document.getElementById('again').onclick = () => start('test');
    document.getElementById('tog').onclick = () => renderResults(!onlyWrong);
  }

  // ---------- browse ----------
  function renderBrowse() {
    const r = st.run;
    h(`<div class="runbar"><button class="back" id="exit" style="margin:0">← ${esc(st.ev.name)}</button><span class="title"></span><span class="mono muted" id="bcount"></span></div>
      <div class="toolbar" style="margin-top:0">
        <input id="bsearch" class="search" type="search" placeholder="Search questions and answers" value="${esc(r.query)}" aria-label="Search questions">
        <label class="opts" style="margin:0"><span><input type="checkbox" id="breveal" ${r.reveal ? 'checked' : ''}> Show all answers</span></label>
      </div>
      <div class="blist" id="blist"></div>
      <div class="actions"><button class="btn" id="more">Show more</button></div>`);
    document.getElementById('exit').onclick = exitRun;
    const draw = () => {
      const qy = r.query.trim().toLowerCase();
      const list = qy ? r.list.filter(q => (q.q + ' ' + q.o.join(' ')).toLowerCase().includes(qy)) : r.list;
      document.getElementById('bcount').textContent = fmt(list.length) + ' questions';
      document.getElementById('blist').innerHTML = list.slice(0, r.shown).map((q, i) => `
        <div class="bq ${r.reveal ? 'show' : ''}" data-id="${q.id}"><div class="qmeta"><span class="mono">${i + 1}</span> ${tagPills(q)}</div>
          <p class="qtext">${esc(q.q)}</p>
          <ol>${q.o.map((o, j) => `<li class="${j === q.a ? 'ok' : ''}"><span class="L">${LETTERS[j]}</span><span>${esc(o)}</span></li>`).join('')}</ol>
          <div class="x" ${r.reveal && q.x ? '' : 'hidden'}>${esc(q.x || '')}</div>
          <div class="row">${r.reveal ? '' : '<button class="linkish showone">Show answer</button>'}${reportLink(st.ev, q)}</div></div>`).join('') || '<p class="empty">No questions match.</p>';
      document.getElementById('more').hidden = list.length <= r.shown;
      app.querySelectorAll('.showone').forEach(b => b.addEventListener('click', () => {
        const card = b.closest('.bq'); card.classList.add('show'); const x = card.querySelector('.x'); if (x.textContent) x.hidden = false; b.remove();
      }));
    };
    draw();
    document.getElementById('bsearch').addEventListener('input', e => { r.query = e.target.value; r.shown = 40; draw(); });
    document.getElementById('breveal').addEventListener('change', e => { r.reveal = e.target.checked; draw(); });
    document.getElementById('more').onclick = () => { r.shown += 60; draw(); };
  }

  // ---------- keyboard ----------
  document.addEventListener('keydown', e => {
    const r = st.run; if (!r || e.target.matches('input, select, textarea')) return;
    const k = e.key;
    if (r.mode === 'quiz') {
      const q = r.list[r.i]; if (!q) return;
      if (r.picked === null) {
        let i = LETTERS.indexOf(k.toUpperCase()); if (i < 0 && /^[1-5]$/.test(k)) i = +k - 1;
        if (i >= 0 && i < q.o.length) { e.preventDefault(); answerQuiz(i); }
      } else if (k === 'Enter' || k === 'ArrowRight') { e.preventDefault(); nextQuiz(); }
    } else if (r.mode === 'cards' && r.list[r.i]) {
      if (k === ' ' || k === 'Enter') { e.preventDefault(); flipCard(); }
      else if (r.flipped && k === 'ArrowRight') gradeCard(true);
      else if (r.flipped && k === 'ArrowLeft') gradeCard(false);
    } else if (r.mode === 'test' && !r.over) {
      const q = r.list[r.i];
      let i = LETTERS.indexOf(k.toUpperCase()); if (i < 0 && /^[1-5]$/.test(k)) i = +k - 1;
      if (i >= 0 && i < q.o.length) { r.ans[q.id] = i; if (r.i + 1 < r.list.length) r.i++; renderTest(); }
      else if (k === 'ArrowRight' && r.i + 1 < r.list.length) { r.i++; renderTest(); }
      else if (k === 'ArrowLeft' && r.i > 0) { r.i--; renderTest(); }
    }
  });

  // ---------- theme toggle + routing ----------
  const tb = document.getElementById('themebtn');
  function themeLabel() { tb.textContent = store.theme === 'dark' ? 'Dark' : store.theme === 'light' ? 'Light' : 'Auto'; tb.title = 'Theme: ' + tb.textContent; }
  if (tb) { themeLabel(); tb.addEventListener('click', () => { store.theme = store.theme === null ? 'dark' : store.theme === 'dark' ? 'light' : null; save(); applyTheme(); themeLabel(); }); }

  async function route() {
    stopTimer();
    const m = location.hash.match(/^#e-([a-z0-9-]+)$/);
    try {
      await loadCatalog();
      if (m) { st.run = null; await openEvent(m[1]); }
      else { st.ev = null; st.run = null; renderHome(); }
    } catch (e) {
      h(`<p class="loading">Couldn't load the question bank. If you opened index.html straight from your computer, run it through a local server (see README) or use the published site.</p>`);
    }
  }
  window.addEventListener('hashchange', route);
  route();
})();
