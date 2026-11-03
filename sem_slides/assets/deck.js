/* ==========================================================================
   deck.js -- runtime for the 1280x720 HTML decks in documents/.

   Footer and numbering, builds, overview, speaker view, jump-to-slide, bar
   tables, the key list and the authoring mode. Load it last, after KaTeX:

     <script src="assets/katex/katex.min.js"></script>
     <script src="assets/katex/contrib/auto-render.min.js"></script>
     <script src="assets/deck.js"></script>

   Everything is configured from the HTML; there is nothing to edit here.

     <html data-theme="board">                    theme (default: manuscript);
                                                  ?theme=board in the URL previews one
     <div id="deck" data-foot="footer text" data-ui="en|fr"
          data-tracker                            storyline tracker on content slides
          data-sticker="Preliminary"              sticker on every content slide
          data-dollar="currency">                 $ is money, not maths
                                                  ($$ .. $$, \( \) and \[ \] still are)
     <div data-include="sections/2-results.html"></div>
                                                  the slides of a section file, in place
                                                  (a split deck needs a server: see below)
     <section class="slide" id="results">        an id is a link target that
                                                  survives inserting slides
     <section class="slide" data-section="II · Results" data-short="Results">
                                                  footer section from here on; data-short
                                                  names it in the tracker and the agenda
     <section class="slide nofoot">               no footer on this slide
     <section class="slide appendix">             backup slide: A1, A2 ..., not counted
     <section class="slide skip">                 kept in the file, left out of this showing
     <section class="slide" data-sticker="Draft"> this slide's sticker ("" for none)
     <section class="slide" data-min="2">         minutes planned: the speaker view keeps pace
     .frag  data-frag="n"  .then-dim              builds
     <aside class="notes"> ... </aside>           speaker notes, shown by S
     <table class="tbl bars" data-max="100" data-decimal=",">
     <ol class="agenda"><li><a href="#results">   an agenda item that links to a slide
                                                  shows that slide's number (.nonum: none)
     <ol class="agenda" data-auto>                agenda built from the sections
     <ol class="hbars" data-max="60" data-unit="%"><li data-v="42">label</li>
     <div class="waterfall" data-unit="M"><div data-v="-1.2">label</div> ... .total

   Every deck folder carries its own copy of this file and of deck.css, so a
   finished talk never changes when the template moves on.
   ========================================================================== */
(function boot() {
  'use strict';

  const deck = document.getElementById('deck');
  if (!deck) return;

  /* ---- section files: the deck starts once every data-include is in ----------
     Each placeholder is replaced by the slides of its file, then this function
     runs again, so a section may include another. Paths, in data-include and
     inside the section alike, are relative to the deck's HTML file. A browser
     does not let a page opened from disk (file://) read other files: open a
     split deck through a local server -- VSCode Live Preview, or
     python3 -m http.server in the deck folder -- or build a one-file copy with
     tools/bundle.py. A file that does not load becomes a slide that says why. */
  const parts = deck.querySelectorAll('[data-include]');
  if (parts.length) {
    boot.depth = (boot.depth || 0) + 1;
    return void Promise.all(Array.from(parts, el => include(el, boot.depth > 4))).then(boot);
  }
  function include(el, tooDeep) {
    const src = el.dataset.include;
    const fail = (why, fix) => {
      const s = document.createElement('section'), h1 = document.createElement('h1'), body = document.createElement('div');
      s.className = 'slide include-error';
      h1.textContent = src + ' did not load';
      body.className = 'body';
      body.innerHTML = '<p></p><div class="note"></div>';
      body.firstChild.textContent = why;
      body.lastChild.textContent = fix;
      s.append(h1, body);
      el.replaceWith(s);
    };
    if (tooDeep) return fail('Section files are nested more than four deep.', 'Check that no file includes itself.');
    return new Promise(done => {
      const xhr = new XMLHttpRequest();
      xhr.overrideMimeType('text/html; charset=utf-8');
      xhr.onload = () => {
        if (xhr.status && (xhr.status < 200 || xhr.status > 299)) {
          fail('The server answered HTTP ' + xhr.status + '.', 'The data-include path is relative to the deck\'s HTML file.');
        } else {
          const t = document.createElement('template');
          t.innerHTML = xhr.responseText;
          t.content.querySelectorAll('script').forEach(x => x.remove());   // slides only (and no live-reload injection)
          el.replaceWith(t.content);
        }
        done();
      };
      xhr.onerror = () => {
        if (location.protocol === 'file:') {
          fail('This deck is split into section files, and a page opened from disk may not read other files.',
               'Open it through a local server (VSCode Live Preview, or python3 -m http.server in the deck folder), '
               + 'or build a one-file copy: python3 tools/bundle.py ' + decodeURIComponent(location.pathname.split('/').pop()));
        } else fail('The file could not be fetched.', 'The data-include path is relative to the deck\'s HTML file.');
        done();
      };
      // no stale section after an edit: bypass the HTTP cache
      xhr.open('GET', /^https?:$/.test(location.protocol) ? src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now() : src);
      xhr.send();
    });
  }

  const QS = new URLSearchParams(location.search);
  const PRESENTER = QS.has('presenter');
  // ?theme=board previews a theme without editing <html data-theme>
  if (QS.get('theme')) document.documentElement.dataset.theme = QS.get('theme');
  // .slide.skip stays in the file but not in this showing: no number, no page in the PDF
  deck.querySelectorAll('.slide.skip').forEach(s => s.remove());
  const slides = Array.from(deck.querySelectorAll('.slide'));
  const N = slides.length;
  const FOOT_ZONE = 42;   // px above the bottom edge kept for the footer, as in tools/check_overflow.py
  const DOLLAR_TEXT = deck.dataset.dollar === 'currency';   // a lone $ is money, not maths

  /* ---- interface strings: data-ui="en" (default) or "fr" ------------------ */
  const UI = {
    en: {
      hint: '? keys', now: 'Now', next: 'Next', build: 'build', end: 'end of deck',
      noNotes: 'No notes for this slide.', reset: 'reset (R)', keysTitle: 'Keys',
      pace: ['plan', 'behind', 'ahead'], story: 'T storyline: titles only  ·  Esc closes',
      keys: [
        ['→  Space  click right', 'next build, then next slide'],
        ['←  click left', 'back'],
        ['Home  End', 'first / last main slide'],
        ['12 Enter   A1 Enter', 'slide 12 / backup slide A1'],
        ['O', 'overview of every slide'],
        ['S', 'speaker view in a second window'],
        ['F', 'fullscreen'],
        ['B', 'black screen; B or Esc returns'],
        ['T  in the overview', 'storyline: every title, in order'],
        ['D', 'authoring mode: guides, overflow, problems'],
        ['?', 'this list'],
        ['Ctrl+P', 'print to PDF, every build shown'],
      ],
    },
    fr: {
      hint: '? touches', now: 'Maintenant', next: 'Ensuite', build: 'étape', end: 'fin de la présentation',
      noNotes: 'Pas de notes pour cette diapositive.', reset: 'remise à zéro (R)', keysTitle: 'Touches',
      pace: ['prévu', 'de retard', "d'avance"], story: 'T fil narratif : titres seuls  ·  Échap ferme',
      keys: [
        ['→  Espace  clic à droite', 'étape suivante, puis diapositive suivante'],
        ['←  clic à gauche', 'retour'],
        ['Début  Fin', 'première / dernière diapositive principale'],
        ['12 Entrée   A1 Entrée', 'diapositive 12 / annexe A1'],
        ['O', "vue d'ensemble"],
        ['S', 'vue orateur dans une seconde fenêtre'],
        ['F', 'plein écran'],
        ['B', 'écran noir ; B ou Échap pour revenir'],
        ["T  dans la vue d'ensemble", "fil narratif : tous les titres, dans l'ordre"],
        ['D', 'mode rédaction : repères, débordements, problèmes'],
        ['?', 'cette liste'],
        ['Ctrl+P', 'imprimer en PDF, toutes les étapes visibles'],
      ],
    },
  };
  const T = UI[deck.dataset.ui] || UI.en;
  const make = (tag, props, ...kids) => {
    const e = Object.assign(document.createElement(tag), props || {});
    e.append(...kids);
    return e;
  };

  /* ---- page chrome, made here so a deck's HTML holds nothing but slides ---- */
  const hint = document.getElementById('help') || document.body.appendChild(make('div', { id: 'help' }));
  hint.textContent = T.hint;
  const jumpEl = document.getElementById('jump') || document.body.appendChild(make('div', { id: 'jump', hidden: true }));
  if (!document.getElementById('ui')) document.body.appendChild(make('div', { id: 'ui' }, make('div', { id: 'bar' })));
  const bar = document.getElementById('bar');

  /* ---- maths: KaTeX renders before anything measures a slide --------------- */
  if (window.renderMathInElement) {
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$', right: '$', display: false },
      ].filter(d => d.left !== '$' || !DOLLAR_TEXT),
      ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
      throwOnError: false,
      errorColor: '#b3432e',
    });
  }

  /* ---- numbering: main slides 1..M, .appendix slides A1, A2 ... ------------ */
  const isApp = slides.map(s => s.classList.contains('appendix'));
  const M = isApp.filter(a => !a).length;
  const label = [], mainNo = [];
  {
    let m = 0, a = 0;
    isApp.forEach((app, k) => { label[k] = app ? 'A' + (++a) : String(mainNo[k] = ++m); });
  }
  const lastMain = isApp.lastIndexOf(false);
  const posText = k => isApp[k] ? label[k] : label[k] + ' / ' + M;
  const hashOf = k => slides[k].id || label[k];
  // '12', '#A2', 'a2', '07', '#results' (a slide's id, or any id inside a slide) -> slide index, or -1
  function lookup(s) {
    let t = String(s).trim().replace(/^#/, '');
    try { t = decodeURIComponent(t); } catch (_) { /* keep it raw */ }
    if (!t) return -1;
    const k = label.indexOf(t.toUpperCase().replace(/^(A?)0+(?=\d)/, '$1'));
    if (k >= 0) return k;
    const el = document.getElementById(t);
    const slide = el && el.closest('.slide');
    return slide ? slides.indexOf(slide) : -1;
  }

  /* ---- sections: data-section names a slide and every slide after it ------- */
  const section = [];
  {
    let s = '';
    slides.forEach((el, k) => { if (el.hasAttribute('data-section')) s = el.dataset.section; section[k] = s; });
  }
  // the storyline: main sections in order, each named by data-short on its first slide
  const story = [];
  slides.forEach((el, k) => {
    if (isApp[k] || !section[k] || story.some(x => x.name === section[k])) return;
    const first = slides.find(x => x.dataset.section === section[k]) || el;
    const sub = first.querySelector('.titlebox .sub, .lead');
    story.push({ name: section[k], short: first.dataset.short || section[k], k: slides.indexOf(first),
                 sub: sub ? sub.textContent.replace(/\s+/g, ' ').trim() : '' });
  });
  // data-min="2": minutes planned per slide, for the pace line in the speaker view
  const planned = slides.map(el => parseFloat(el.dataset.min) || 0), planStart = [];
  { let t = 0; planned.forEach((m, k) => { planStart[k] = t; t += m; }); }
  const planTotal = planned.reduce((a, b) => a + b, 0);

  /* ---- footer on every slide but .nofoot (kept in the DOM, so it prints) ---- */
  slides.forEach((s, k) => {
    if (s.classList.contains('nofoot')) return;
    const right = make('span');
    if (section[k]) right.append(make('span', { className: 'fsec', textContent: section[k] }));
    right.append(make('span', { className: 'fnum', textContent: posText(k) }));
    s.appendChild(make('div', { className: 'foot' }, make('span', { textContent: deck.dataset.foot || '' }), right));
  });

  /* ---- storyline chrome: tracker chips, stickers, agendas built from sections --- */
  if (deck.hasAttribute('data-tracker') && story.length) slides.forEach((s, k) => {
    if (isApp[k] || !section[k] || s.classList.contains('dark') || s.classList.contains('nofoot')) return;
    s.appendChild(make('div', { className: 'tracker' },
      ...story.map(x => make('span', { className: x.name === section[k] ? 'on' : '', textContent: x.short }))));
  });
  slides.forEach(s => {
    const text = s.hasAttribute('data-sticker') ? s.dataset.sticker
      : s.classList.contains('dark') || s.classList.contains('nofoot') ? '' : deck.dataset.sticker || '';
    if (text) s.appendChild(make('div', { className: 'sticker', textContent: text }));
  });
  deck.querySelectorAll('ol.agenda[data-auto]').forEach(ol => {
    const here = section[slides.indexOf(ol.closest('.slide'))];
    ol.replaceChildren(...story.map(x => {
      const li = make('li', { className: x.name === here ? 'cur' : '' }, make('a', { href: '#' + hashOf(x.k), textContent: x.short }));
      if (x.sub) li.append(make('span', { className: 'd', textContent: x.sub }));
      return li;
    }));
  });
  // an agenda item that links to a slide shows that slide's number, so inserting a slide never stales it
  deck.querySelectorAll('ol.agenda > li').forEach(li => {
    const a = li.querySelector('a[href^="#"]'), k = a ? lookup(a.getAttribute('href')) : -1;
    if (k >= 0) li.prepend(make('span', { className: 'pg', textContent: label[k] }));
  });

  /* ---- table.bars: size each td.v bar from its own text --------------------
     against data-max (default 100); the decimal mark is data-decimal="," on the
     table, else guessed from <html lang>. A cell's own style="--v:42" wins. */
  const langComma = /^(fr|de|es|it|pt|nl|ru|pl|tr)\b/i.test(document.documentElement.lang);
  deck.querySelectorAll('table.bars').forEach(t => {
    const max = parseFloat(t.dataset.max) || 100;
    const commaDecimal = t.dataset.decimal ? t.dataset.decimal === ',' : langComma;
    t.querySelectorAll('td.v:not(.na)').forEach(td => {
      if (td.style.getPropertyValue('--v')) return;
      let x = td.textContent.replace(/[\s  %+]/g, '').replace('−', '-');
      x = commaDecimal ? x.replace(/\./g, '').replace(',', '.') : x.replace(/,/g, '');
      const v = parseFloat(x);
      if (!isNaN(v)) td.style.setProperty('--v', Math.max(0, Math.min(100, 100 * v / max)).toFixed(2));
    });
  });

  /* ---- ol.hbars: a track and a printed value for every li[data-v] ------------ */
  deck.querySelectorAll('ol.hbars').forEach(ol => {
    const items = Array.from(ol.children).filter(li => li.dataset.v !== undefined);
    const max = parseFloat(ol.dataset.max) || Math.max(...items.map(li => parseFloat(li.dataset.v) || 0)) || 1;
    items.forEach(li => {
      const bar = make('i');
      bar.style.setProperty('--v', Math.max(0, Math.min(100, 100 * (parseFloat(li.dataset.v) || 0) / max)).toFixed(2));
      li.replaceChildren(make('span', { className: 'l' }, ...li.childNodes), make('span', { className: 't' }, bar),
        make('span', { className: 'n', textContent: li.dataset.label || li.dataset.v + (ol.dataset.unit || '') }));
    });
  });

  /* ---- .waterfall: running totals -> bar extents, printed values, connectors ---- */
  deck.querySelectorAll('.waterfall').forEach(w => {
    const dec = w.dataset.decimals !== undefined ? +w.dataset.decimals : 1, unit = w.dataset.unit || '';
    let run = 0;
    const cols = Array.from(w.children).map(c => {
      const total = c.classList.contains('total'), v = parseFloat(c.dataset.v);
      if (total) { if (!isNaN(v)) run = v; return { c, total, lo: Math.min(0, run), hi: Math.max(0, run), end: run, shown: run }; }
      const from = run;
      run += isNaN(v) ? 0 : v;
      return { c, total, lo: Math.min(from, run), hi: Math.max(from, run), end: run, shown: run - from };
    });
    const top = Math.max(...cols.map(x => x.hi)) * 1.14 || 1, pct = x => (100 * x / top).toFixed(2);
    const fmt = (x, signed) => (x < 0 ? '−' : signed && x > 0 ? '+' : '') + Math.abs(x).toFixed(dec) + unit;
    cols.forEach(x => {
      x.c.classList.add('wf', x.total ? 'total' : x.shown >= 0 ? 'up' : 'down');
      const plot = make('div', { className: 'wf-plot' }, make('i', { className: 'wf-bar' }),
        make('b', { className: 'wf-val', textContent: x.c.dataset.label || fmt(x.shown, !x.total) }));
      plot.style.cssText = '--lo:' + pct(x.lo) + ';--hi:' + pct(x.hi) + ';--end:' + pct(x.end);
      x.c.replaceChildren(plot, make('div', { className: 'wf-lab' }, ...x.c.childNodes));
    });
  });

  /* ---- builds ---------------------------------------------------------------- */
  function builds(root) {
    const fr = Array.from(root.querySelectorAll('.frag')).filter(f => !f.closest('aside.notes'));
    const val = fr.map((f, i) => { const v = parseFloat(f.dataset.frag); return isNaN(v) ? i + 1 : v; });
    const order = [...new Set(val)].sort((a, b) => a - b);
    return { fr, rank: val.map(v => order.indexOf(v) + 1), n: order.length };
  }
  const nBuilds = slides.map(s => builds(s).n);
  function setBuild(root, step) {
    const { fr, rank } = builds(root);
    fr.forEach((f, i) => {
      f.classList.toggle('on', rank[i] <= step);
      f.classList.toggle('past', rank[i] < step);
    });
  }

  /* ---- slide clones, for the overview and the speaker view ------------------
     url(#id) and href="#id" resolve to the FIRST element with that id: the
     original, inside a display:none slide, where Chrome paints no marker or
     gradient. So ids referenced inside a clone get a per-clone suffix. */
  let seq = 0;
  function cloneSlide(k, step) {
    const c = slides[k].cloneNode(true);
    c.classList.add('active');
    c.querySelectorAll('aside.notes').forEach(n => n.remove());
    const els = [c, ...c.querySelectorAll('*')], refs = new Set();
    for (const el of els) for (const at of el.attributes) {
      for (const m of at.value.matchAll(/url\(\s*['"]?#([^'")\s]+)/g)) refs.add(m[1]);
      if (/href$/.test(at.name) && at.value[0] === '#') refs.add(at.value.slice(1));
    }
    const sfx = '--c' + (++seq), renamed = new Set();
    for (const el of els) if (el.id && refs.has(el.id)) { renamed.add(el.id); el.id += sfx; }
    if (renamed.size) for (const el of els) for (const at of el.attributes) {
      const v = at.value
        .replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g, (m, q, id) => renamed.has(id) ? 'url(#' + id + sfx + ')' : m)
        .replace(/^#(.+)$/, (m, id) => /href$/.test(at.name) && renamed.has(id) ? '#' + id + sfx : m);
      if (v !== at.value) at.value = v;
    }
    setBuild(c, step);
    return c;
  }

  /* ---- navigation ------------------------------------------------------------
     State is (slide, build). With a speaker view open both windows hold it and
     the newest change wins; a freshly loaded audience window counts as the
     newest, so reloading the deck pulls the speaker view along. */
  let cur = 0, step = 0, stamp = PRESENTER ? 0 : Date.now(), peer = null;
  let sorter = null, sorterOpen = false, sel = 0;
  let pv = null, notesFor = -1, resetTimer = () => {};
  let dev = false, devEl = null, devProblems = [];
  let blackEl = null;

  function go(k, s, remote) {
    cur = Math.max(0, Math.min(N - 1, k));
    step = Math.max(0, Math.min(nBuilds[cur], s | 0));
    render();
    if (!remote) { stamp = Date.now(); send({ deck: 'state', k: cur, s: step, t: stamp }); }
  }
  const next = () => step < nBuilds[cur] ? go(cur, step + 1) : cur < N - 1 && go(cur + 1, 0);
  const prev = () => step > 0 ? go(cur, step - 1) : cur > 0 && go(cur - 1, nBuilds[cur - 1]);

  function render() {
    try { history.replaceState(null, '', '#' + hashOf(cur)); } catch (_) { /* sandboxed page */ }
    if (sorterOpen) markSorter();
    if (PRESENTER) return renderPresenter();
    slides.forEach((s, k) => s.classList.toggle('active', k === cur));
    setBuild(slides[cur], step);
    bar.style.width = (isApp[cur] || M < 2 ? 100 : 100 * (mainNo[cur] - 1) / (M - 1)) + '%';
    if (dev) { markOverflow(); renderDev(); }
  }

  function send(msg) { try { if (peer && !peer.closed) peer.postMessage(msg, '*'); } catch (_) { /* window gone */ } }
  addEventListener('message', e => {
    const d = e.data;
    if (!d || typeof d !== 'object' || !d.deck) return;
    if (!PRESENTER && e.source) peer = e.source;      // a (re)loaded speaker view says hello
    if (d.deck === 'hello') send({ deck: 'state', k: cur, s: step, t: stamp });
    else if (d.deck === 'state' && d.t > stamp) { stamp = d.t; go(d.k, d.s, true); }
    else if (d.deck === 'black' && !PRESENTER) toggleBlack();
  });

  /* ---- speaker view: S opens this same file with ?presenter ------------------ */
  function openPresenter() {
    const theme = QS.get('theme') ? '&theme=' + encodeURIComponent(QS.get('theme')) : '';
    const url = location.href.split('#')[0].split('?')[0] + '?presenter' + theme + '#' + hashOf(cur);
    peer = window.open(url, 'deck-presenter', 'popup,width=1440,height=860') || peer;
  }
  function buildPresenter() {
    document.body.classList.add('presenter');
    document.title = 'Presenter — ' + document.title;
    const timer = make('button', { className: 'timer', title: T.reset, textContent: '00:00' });
    const wall = make('span', { className: 'wall' });
    const pace = make('span', { className: 'pace' });
    pv = make('div', { id: 'pv' },
      make('section', { className: 'now' },
        make('div', { className: 'bar' }, make('b', { textContent: T.now }), make('span', { className: 'pos' })),
        make('div', { className: 'stage' })),
      make('section', {},
        make('div', { className: 'bar' }, make('b', { textContent: T.next }), make('span', { className: 'npos' })),
        make('div', { className: 'stage' }),
        make('div', { className: 'clock' }, timer, pace, wall),
        make('div', { className: 'notes' })));
    document.body.appendChild(pv);
    const two = n => String(n).padStart(2, '0');
    let t0 = Date.now();
    const tick = () => {
      const e = Math.floor((Date.now() - t0) / 1000), d = new Date();
      timer.textContent = (e >= 3600 ? Math.floor(e / 3600) + ':' : '') + two(Math.floor(e / 60) % 60) + ':' + two(e % 60);
      wall.textContent = two(d.getHours()) + ':' + two(d.getMinutes());
      if (planTotal) {   // behind once past this slide's planned end, ahead while before its planned start
        const mmss = x => Math.floor(x / 60) + ':' + two(Math.floor(x % 60));
        const a = planStart[cur] * 60, b = a + planned[cur] * 60, late = e - b, early = a - e;
        pace.textContent = T.pace[0] + ' ' + mmss(a) + '–' + mmss(b) + ' / ' + planTotal + ' min'
          + (late > 0 ? ' · ' + mmss(late) + ' ' + T.pace[1] : early > 0 ? ' · ' + mmss(early) + ' ' + T.pace[2] : '');
        pace.className = 'pace' + (late > 0 ? ' behind' : early > 0 ? ' ahead' : '');
      }
    };
    resetTimer = () => { t0 = Date.now(); tick(); };
    timer.addEventListener('click', () => { resetTimer(); timer.blur(); });
    setInterval(tick, 500);
    tick();
  }
  function renderPresenter() {
    const more = step < nBuilds[cur], [now, nxt] = pv.querySelectorAll('.stage');
    now.replaceChildren(cloneSlide(cur, step));
    if (more) nxt.replaceChildren(cloneSlide(cur, step + 1));
    else if (cur < N - 1) nxt.replaceChildren(cloneSlide(cur + 1, 0));
    else nxt.replaceChildren(make('div', { className: 'end', textContent: T.end }));
    pv.querySelector('.pos').textContent = posText(cur)
      + (nBuilds[cur] ? ' · ' + T.build + ' ' + step + '/' + nBuilds[cur] : '')
      + (section[cur] ? ' · ' + section[cur] : '');
    pv.querySelector('.npos').textContent = more
      ? T.build + ' ' + (step + 1) + '/' + nBuilds[cur]
      : cur < N - 1 ? posText(cur + 1) : '';
    if (notesFor !== cur) {
      const notes = slides[cur].querySelector('aside.notes'), box = pv.querySelector('.notes');
      if (notes) box.innerHTML = notes.innerHTML;
      else box.replaceChildren(make('span', { className: 'none', textContent: T.noNotes }));
      box.scrollTop = 0;
      notesFor = cur;
    }
    fitStages();
  }
  function fitStages() {
    pv.querySelectorAll('.stage').forEach(st => st.style.setProperty('--s', st.clientWidth / 1280));
  }

  /* ---- overview (O) ------------------------------------------------------------ */
  function buildSorter() {
    const grid = make('div', { className: 'grid' });
    slides.forEach((s, k) => {
      if (section[k] && section[k] !== section[k - 1]) grid.appendChild(make('div', { className: 'sec', textContent: section[k] }));
      const h1 = s.querySelector('h1') && s.querySelector('h1').cloneNode(true);
      if (h1) h1.querySelectorAll('br').forEach(b => b.replaceWith(' '));
      const th = make('div', { className: 'th', title: s.id ? '#' + s.id : '' },
        make('div', { className: 'frame' }, cloneSlide(k, nBuilds[k])),
        make('div', { className: 'lab' },
          make('span', { textContent: label[k] }),
          make('span', { textContent: h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : '' })));
      th.dataset.k = k;
      th.addEventListener('click', () => { closeSorter(); go(k, 0); });
      grid.appendChild(th);
    });
    sorter = make('div', { id: 'sorter' }, make('div', { className: 'hint', textContent: T.story }), grid);
    document.body.appendChild(sorter);
  }
  function fitSorter() {
    const f = sorter.querySelector('.frame');
    if (f) sorter.style.setProperty('--s', f.clientWidth / 1280);
  }
  function markSorter() {
    sorter.querySelectorAll('.th').forEach(th => {
      th.classList.toggle('cur', +th.dataset.k === cur);
      th.classList.toggle('sel', +th.dataset.k === sel);
    });
    const el = sorter.querySelector('.th.sel');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
  function openSorter() {
    if (!sorter) buildSorter();
    sorter.hidden = false;
    sorterOpen = true;
    sel = cur;
    fitSorter();
    markSorter();
  }
  function closeSorter() { if (sorter) sorter.hidden = true; sorterOpen = false; }

  /* ---- key list (?) ------------------------------------------------------------ */
  let keysEl = null;
  function toggleKeys(show) {
    if (!keysEl) {
      keysEl = make('div', { id: 'keys', hidden: true },
        make('div', { className: 'box' },
          make('h2', { textContent: T.keysTitle }),
          make('table', {}, ...T.keys.map(([k, v]) => make('tr', {}, make('td', { textContent: k }), make('td', { textContent: v }))))));
      keysEl.addEventListener('click', () => toggleKeys(false));
      document.body.appendChild(keysEl);
    }
    keysEl.hidden = show === undefined ? !keysEl.hidden : !show;
  }

  /* ---- authoring mode (D) ---------------------------------------------------------
     Guides for the content box and the footer zone, every build visible, content
     allowed to spill past the slide edge so you see what would be clipped,
     overflowing elements outlined, and a panel listing the deck's problems --
     overflow, broken images, maths errors, links to nowhere, duplicate ids --
     each a click away. Remembered per file while you edit; never in print, in
     the speaker view, or in the tools (they start from a clean profile). */
  const DEV_KEY = 'deck.dev:' + location.pathname;
  const describe = el => {
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(c => c && c !== 'dev-over') : [];
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    return '<' + el.tagName.toLowerCase() + (cls.length ? '.' + cls.join('.') : '') + '>' + (text ? ' "' + text.slice(0, 36) + (text.length > 36 ? '…"' : '"') : '');
  };
  function overflowOf(s) {
    // the rule of tools/check_overflow.py: past the left/right edge, or into the footer zone
    const box = s.getBoundingClientRect(), scale = box.width / 1280 || 1, limit = box.bottom - FOOT_ZONE * scale, found = [];
    s.querySelectorAll('*').forEach(el => {
      if (el.ownerSVGElement || el.closest('.foot, .vstrip, .watermark, .katex-mathml, aside.notes')) return;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      const o = { el, below: (r.bottom - limit) / scale, right: (r.right - box.right) / scale, left: (box.left - r.left) / scale };
      if (o.below > 1 || o.right > 1 || o.left > 1) found.push(o);
    });
    return found.filter(o => !found.some(p => p.el !== o.el && p.el.contains(o.el)));   // outermost only
  }
  function scanProblems() {
    const list = [];
    slides.forEach((s, k) => {
      slides.forEach((x, j) => x.classList.toggle('active', j === k));
      overflowOf(s).forEach(o => {
        const by = [o.below > 1 && '+' + Math.round(o.below) + 'px into the footer',
                    o.right > 1 && '+' + Math.round(o.right) + 'px right',
                    o.left > 1 && '+' + Math.round(o.left) + 'px left'].filter(Boolean).join(', ');
        list.push({ k, kind: 'overflow', text: describe(o.el) + ' ' + by });
      });
      s.querySelectorAll('img').forEach(img => {
        if (img.complete && !img.naturalWidth) list.push({ k, kind: 'image', text: (img.getAttribute('src') || '(no src)') + ' does not load' });
      });
      s.querySelectorAll('h1.action').forEach(h => {
        const lines = Math.round(h.offsetHeight / (parseFloat(getComputedStyle(h).lineHeight) || h.offsetHeight || 1));
        if (lines > 2) list.push({ k, kind: 'title', text: 'action title runs to ' + lines + ' lines; keep it to two' });
      });
      if (s.classList.contains('include-error')) list.push({ k, kind: 'include', text: s.querySelector('h1').textContent });
      s.querySelectorAll('.katex-error').forEach(e => list.push({ k, kind: 'maths', text: (e.getAttribute('title') || e.textContent).slice(0, 90) }));
      // KaTeX only renders a delimiter it can pair, and an unbalanced brace keeps $...$
      // open: the source then stays on the slide as raw text, with no error at all
      const texts = document.createTreeWalker(s, NodeFilter.SHOW_TEXT);
      for (let node; (node = texts.nextNode());) {
        const host = node.parentElement, m = node.nodeValue.match(DOLLAR_TEXT ? /\$\$|\\\(|\\\[/ : /\$|\\\(|\\\[/);
        if (!m || !host || host.closest('pre, code, script, style, textarea, .katex, .foot')) continue;
        const around = node.nodeValue.slice(Math.max(0, m.index - 8), m.index + 28).replace(/\s+/g, ' ').trim();
        list.push({ k, kind: 'maths', text: 'not rendered: "' + around + '" (unbalanced { } or delimiter?)' });
      }
      s.querySelectorAll('a[href^="#"]').forEach(a => {
        const h = a.getAttribute('href');
        if (h.length > 1 && lookup(h) < 0) list.push({ k, kind: 'link', text: h + ' leads nowhere' });
      });
    });
    slides.forEach((x, j) => x.classList.toggle('active', j === cur));
    const count = new Map();
    deck.querySelectorAll('[id]').forEach(e => count.set(e.id, (count.get(e.id) || 0) + 1));
    count.forEach((n, id) => {
      if (n > 1) list.push({ k: slides.indexOf(deck.querySelector('#' + CSS.escape(id)).closest('.slide')), kind: 'id', text: '#' + id + ' is used ' + n + ' times' });
    });
    return list;
  }
  function markOverflow() {
    deck.querySelectorAll('.dev-over').forEach(e => e.classList.remove('dev-over'));
    if (dev) overflowOf(slides[cur]).forEach(o => o.el.classList.add('dev-over'));
  }
  function renderDev(rescan) {
    if (!dev) return;
    if (!devEl) {
      devEl = make('div', { id: 'dev' });
      devEl.addEventListener('click', e => {
        const li = e.target.closest('li[data-k]');
        if (li && +li.dataset.k >= 0) go(+li.dataset.k, 0);
      });
      document.body.appendChild(devEl);
    }
    if (rescan) devProblems = scanProblems();
    const s = slides[cur], h1 = s.querySelector('h1');
    const where = [posText(cur), s.id && '#' + s.id, section[cur],
                   nBuilds[cur] && nBuilds[cur] + (nBuilds[cur] > 1 ? ' builds' : ' build'),
                   h1 && h1.textContent.replace(/\s+/g, ' ').trim().slice(0, 44)].filter(Boolean).join(' · ');
    const items = devProblems.map(p => {
      const li = make('li', { className: p.k === cur ? 'here' : '' }, make('b', { textContent: (p.k >= 0 ? label[p.k] : '?') + ' ' + p.kind }), ' ' + p.text);
      li.dataset.k = p.k;
      return li;
    });
    devEl.replaceChildren(
      make('div', { className: 'hd' },
        make('span', { textContent: devProblems.length ? 'Authoring · ' + devProblems.length + ' problem' + (devProblems.length > 1 ? 's' : '') : 'Authoring' }),
        make('span', { textContent: 'D to leave' })),
      make('div', { className: 'where', textContent: where }),
      items.length ? make('ul', {}, ...items)
                   : make('div', { className: 'ok', textContent: 'No problems: nothing overflows, every image loads, all maths renders, every #link lands.' }));
  }
  function setDev(on) {
    if (PRESENTER) return;
    dev = on;
    try { if (on) localStorage.setItem(DEV_KEY, '1'); else localStorage.removeItem(DEV_KEY); } catch (_) { /* no storage */ }
    document.body.classList.toggle('dev', on);
    if (devEl) devEl.hidden = !on;
    markOverflow();
    renderDev(true);
  }

  /* ---- black screen (B): from the speaker view it blacks the audience window ---- */
  function toggleBlack() {
    if (PRESENTER) return send({ deck: 'black' });
    if (!blackEl) {
      blackEl = document.body.appendChild(make('div', { id: 'black', hidden: true }));
      blackEl.addEventListener('click', () => toggleBlack());
    }
    blackEl.hidden = !blackEl.hidden;
  }

  /* ---- keys and clicks ------------------------------------------------------------ */
  let typed = '', typedTimer = 0;
  function showTyped() {
    jumpEl.textContent = typed;
    jumpEl.hidden = !typed;
    clearTimeout(typedTimer);
    if (typed) typedTimer = setTimeout(() => { typed = ''; showTyped(); }, 2500);
  }
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;              // leave Ctrl+P etc. alone
    const target = e.target;
    if (target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))) return;
    const key = e.key;
    if (blackEl && !blackEl.hidden && key === 'Escape') { toggleBlack(); e.preventDefault(); return; }
    if (keysEl && !keysEl.hidden) {
      toggleKeys(false);
      if (key === '?' || key === 'Escape') { e.preventDefault(); return; }
    }
    if (sorterOpen) {
      const cols = getComputedStyle(sorter.querySelector('.grid')).gridTemplateColumns.split(' ').length;
      const mv = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[key];
      if (mv) { sel = Math.max(0, Math.min(N - 1, sel + mv)); markSorter(); }
      else if (key === 'Enter' || key === ' ') { closeSorter(); go(sel, 0); }
      else if (key === 'Escape' || key === 'o' || key === 'O') closeSorter();
      else if (key === 't' || key === 'T') { sorter.classList.toggle('story'); fitSorter(); markSorter(); }
      else return;
      e.preventDefault();
      return;
    }
    // 12 Enter -> slide 12, A2 Enter -> backup slide A2
    if (/^\d$/.test(key) || (/^a$/i.test(key) && !typed)) { typed += key.toUpperCase(); showTyped(); return; }
    if (typed && (key === 'Enter' || key === 'Escape' || key === 'Backspace')) {
      const k = key === 'Enter' ? lookup(typed) : -1;
      typed = key === 'Backspace' ? typed.slice(0, -1) : '';
      showTyped();
      if (k >= 0) go(k, 0);
      e.preventDefault();
      return;
    }
    if (key === 'ArrowRight' || key === 'ArrowDown' || key === ' ' || key === 'PageDown') { next(); e.preventDefault(); }
    else if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp') { prev(); e.preventDefault(); }
    else if (key === 'Home') go(0, 0);
    else if (key === 'End') go(lastMain < 0 ? N - 1 : lastMain, 0);   // backup slides lie past the end
    else if (key === 'o' || key === 'O') openSorter();
    else if ((key === 's' || key === 'S') && !PRESENTER) openPresenter();
    else if ((key === 'r' || key === 'R') && PRESENTER) resetTimer();
    else if ((key === 'd' || key === 'D') && !PRESENTER) setDev(!dev);
    else if (key === 'b' || key === 'B') toggleBlack();
    else if (key === '?') toggleKeys(true);
    else if (key === 'f' || key === 'F') {
      document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    }
  });
  // click: right 2/3 forward, left 1/3 back -- not on a link, a button, a panel, or while authoring
  addEventListener('click', e => {
    if (PRESENTER || sorterOpen || dev || e.target.closest('a, button, #sorter, #dev, #keys, #black')) return;
    (e.clientX > innerWidth / 3) ? next() : prev();
  });
  // deep links: #7, #A1, #results; the back button works
  addEventListener('hashchange', () => {
    const k = lookup(location.hash);
    if (k >= 0 && k !== cur) go(k, 0);
  });
  function fit() {
    if (PRESENTER) fitStages();
    else deck.style.transform = 'scale(' + Math.min(innerWidth / 1280, innerHeight / 720) + ')';
    if (sorterOpen) fitSorter();
  }
  addEventListener('resize', fit);

  /* ---- start ------------------------------------------------------------------------ */
  if (PRESENTER) {
    buildPresenter();
    peer = window.opener;
    if (peer) { send({ deck: 'hello' }); setInterval(() => send({ deck: 'hello' }), 1000); }
  }
  const k0 = lookup(location.hash);
  go(k0 >= 0 ? k0 : 0, 0, true);
  fit();
  if (!PRESENTER) {
    let wanted = false;
    try { wanted = localStorage.getItem(DEV_KEY) === '1'; } catch (_) { /* no storage */ }
    if (wanted) setDev(true);
    // images and webfonts land after this script: measure again once they have
    const remeasure = () => { if (dev) { markOverflow(); renderDev(true); } };
    if (document.readyState !== 'complete') addEventListener('load', remeasure);
    else Promise.all(Array.from(deck.querySelectorAll('img'), img => img.complete || new Promise(r => {   // section files
      img.addEventListener('load', r, { once: true });                                                  // arrived after load
      img.addEventListener('error', r, { once: true });
    }))).then(remeasure);
    if (document.fonts) document.fonts.ready.then(remeasure);
  }

  // for the browser console: Deck.go('results'), Deck.problems()
  window.Deck = { go: target => { const k = lookup(target); if (k >= 0) go(k, 0); return k; }, next, prev, problems: scanProblems };
})();
