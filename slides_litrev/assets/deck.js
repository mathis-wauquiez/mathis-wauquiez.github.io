/* ==========================================================================
   deck.js -- runtime for the 1280x720 HTML decks in documents/.

   Footer and numbering, builds, transitions, overview, speaker view,
   jump-to-slide, bar tables, the key list and the authoring mode. Load it last, after KaTeX:

     <script src="assets/katex/katex.min.js"></script>
     <script src="assets/katex/contrib/auto-render.min.js"></script>
     <script src="assets/deck.js"></script>

   Everything is configured from the HTML; there is nothing to edit here.

     <div id="deck" data-foot="footer text" data-ui="en|fr">
     <div data-include="sections/2-results.html"></div>
                                                  the slides of a section file, in place
                                                  (a split deck needs a server: see below)
     <section class="slide" id="results">        an id is a link target that
                                                  survives inserting slides
     <section class="slide" data-section="II · Results">  footer section from here on
     <section class="slide nofoot">               no footer on this slide
     <section class="slide appendix">             backup slide: A1, A2 ..., not counted
     .frag  data-frag="n"  .then-dim              builds
     <aside class="notes"> ... </aside>           speaker notes, shown by S
     X / Shift+X                                  rewards on the way through (points, cards...) / reset
     <div id="deck" data-transitions="pro">       default transitions: off | pro | bowling |
                                                  arcade | cinema | cartoon | memes | chaos | games
                                                  (T cycles; games: win a game to move on)
     <table class="tbl bars" data-max="100" data-decimal=",">
     <ol class="agenda"><li><a href="#results">   an agenda item that links to a slide
                                                  shows that slide's number (.nonum: none)

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

  const PRESENTER = new URLSearchParams(location.search).has('presenter');
  const slides = Array.from(deck.querySelectorAll('.slide'));
  const N = slides.length;
  const FOOT_ZONE = 42;   // px above the bottom edge kept for the footer, as in tools/check_overflow.py

  /* ---- interface strings: data-ui="en" (default) or "fr" ------------------ */
  const UI = {
    en: {
      hint: '? keys', now: 'Now', next: 'Next', build: 'build', end: 'end of deck',
      noNotes: 'No notes for this slide.', reset: 'reset (R)', keysTitle: 'Keys',
      fx: { off: 'Transitions: off', pro: 'Transitions: professional', bowling: 'Transitions: bowling', arcade: 'Transitions: arcade',
            cinema: 'Transitions: silent film', cartoon: 'Transitions: cartoon', memes: 'Transitions: memes', chaos: 'Transitions: chaos (all of the fun ones)',
            games: 'Transitions: games (win to move on)' },
      fine: 'This is fine.', impostor: '1 impostor remains.', ejected: n => `Slide ${n} was not the impostor.`,
      errTitle: 'Error', errMsg: 'The next slide is too awesome to be displayed.', loading: 'Loading the next slide…',
      rw: {
        toast: ['Rewards: off', 'Rewards: on (X) -- Shift+X starts over'], reset: 'Rewards: progress reset',
        slide: 'Slide', fresh: 'First visit', won: 'Game won', clean: 'Flawless', fast: 'Lightning', chapterLine: 'Chapter cleared',
        combo: 'Combo', crit: 'CRITICAL', levelUp: 'Level up', chapter: 'CHAPTER CLEARED!', extreme: 'EXTREME FEVER', breaker: 'COMBO BREAKER',
        words: { 3: 'Sweet!', 5: 'Tasty!', 8: 'Divine!', 12: 'Legendary!', 20: 'Unstoppable!' },
        rarity: ['Common', 'Rare', 'Epic', 'Legendary'], newCard: 'New card!', upgrade: 'Card upgraded!', unlocked: 'Achievement unlocked',
        stats: ['Score', 'Level', 'Cards', 'Achievements', 'Best combo'],
        ach: {
          first: ['First step', 'past your first slide'], combo5: ['In the groove', 'a combo of 5'], combo10: ['Unstoppable', 'a combo of 10'],
          back: ['Back to the future', 'go back a slide'], crit: ['Critical hit', 'a first critical'], rare: ['Lucky', 'a rare card'],
          epic: ['Epic!', 'an epic card'], legendary: ['Living legend', 'a legendary card'], chapter: ['Chapter cleared', 'finish a chapter'],
          half: ['Halfway there', 'half the deck'], end: ['Light at the end', 'the last slide'], speed: ['Speedrun', 'three slides in four seconds'],
          gamer: ['Gamer', 'win five games'], perfect: ['Perfectionist', 'a flawless game with a Perfect'], collector: ['Collector', 'twenty cards'],
        },
      },
      games: {
        skip: 'Esc: skip', win: 'Well done!', perfect: 'Perfect!', perfectShort: 'Perfect', good: 'Good', again: 'Again!', swish: 'Swish!',
        ouch: 'Ouch!', boom: 'Boom!', combo: 'Combo', wind: 'Wind', words: ['Next', 'slide', 'almost', 'there'], miss: 'Missed!', early: 'Too early!', late: 'Too slow!', wait: 'Wait for it…', fire: 'FIRE!',
        taquin: ['Sliding puzzle', 'put the next slide back together: arrows or click · Space: a helping move'],
        rotate: ['Upright', 'arrows to choose, Space to turn, or click'],
        toss: ['Crumple it!', 'Space or click: aim, then power -- mind the wind'],
        hero: ['Slide Hero', '← → (or click left / right) in time; Space plays the nearest note'],
        slice: ['Slice it!', 'swipe the mouse through the pieces, or Space for a sword stroke -- not the bomb!'],
        run: ['Run', 'Space, ↑ or click to jump (hold to go higher); go under the floating words'],
        stack: ['Stack', 'stop each band right over the one below: Space, → or click'],
        safe: ['Safe', 'Space, → or click when the green zone is under the mark'],
        bridge: ['Bridge', 'hold Space, → or the mouse to grow the bridge, let go to lay it across'],
        breakout: ['Breakout', 'break half the slide: ← → or the mouse'],
        catch: ['Catch it', 'click the thumbnail, or Space while it crosses the ring'],
        mash: ['Push!', 'Space, → or click, as fast as you can'],
        duel: ['Duel', 'at FIRE!, Space, → or click -- not before'],
        memory: ['Memory', 'find the pairs: arrows + Space, or click'],
      },
      sound: ['Transition sound: off', 'Transition sound: on (M)'],
      cards: ['Meanwhile…', 'Later that day…', 'Next chapter', 'And suddenly…', 'A few moments later', 'Meanwhile, at the lab…',
              'But that is not all…', 'End of reel one', 'The plot thickens…'],
      keys: [
        ['→  Space  click right', 'next build, then next slide'],
        ['←  click left', 'back'],
        ['Home  End', 'first / last main slide'],
        ['12 Enter   A1 Enter', 'slide 12 / backup slide A1'],
        ['O', 'overview of every slide'],
        ['S', 'speaker view in a second window'],
        ['F', 'fullscreen'],
        ['D', 'authoring mode: guides, overflow, problems'],
        ['T  Shift+T', 'next / previous transitions: off, pro, bowling, arcade, cinema, cartoon, memes, chaos, games'],
        ['M', 'sound for the fun transitions, on / off'],
        ['N', 'show each transition\'s name as it plays (copied as data-fx="..." to pin it on that slide)'],
        ['X  Shift+X', 'rewards: points, combos, levels, cards, trophies / start over'],
        ['?', 'this list'],
        ['Ctrl+P', 'print to PDF, every build shown'],
      ],
    },
    fr: {
      hint: '? touches', now: 'Maintenant', next: 'Ensuite', build: 'étape', end: 'fin de la présentation',
      noNotes: 'Pas de notes pour cette diapositive.', reset: 'remise à zéro (R)', keysTitle: 'Touches',
      fx: { off: 'Transitions : désactivées', pro: 'Transitions : professionnelles', bowling: 'Transitions : bowling', arcade: 'Transitions : arcade',
            cinema: 'Transitions : cinéma muet', cartoon: 'Transitions : dessin animé', memes: 'Transitions : mèmes', chaos: 'Transitions : chaos (tout le rigolo à la fois)',
            games: 'Transitions : jeux (gagnez pour avancer)' },
      fine: 'Tout va bien.', impostor: '1 imposteur restant.', ejected: n => `La diapositive ${n} n\u2019était pas l\u2019imposteur.`,
      errTitle: 'Erreur', errMsg: 'La diapositive suivante est trop géniale pour être affichée.', loading: 'Chargement de la diapositive suivante…',
      rw: {
        toast: ['Récompenses : coupées', 'Récompenses : activées (X) -- Maj+X remet à zéro'], reset: 'Récompenses : progression remise à zéro',
        slide: 'Diapositive', fresh: 'Première visite', won: 'Jeu gagné', clean: 'Sans faute', fast: 'Éclair', chapterLine: 'Chapitre bouclé',
        combo: 'Combo', crit: 'CRITIQUE', levelUp: 'Niveau', chapter: 'CHAPITRE TERMINÉ !', extreme: 'EXTRÊME FEVER', breaker: 'COMBO BREAKER',
        words: { 3: 'Sympa !', 5: 'Excellent !', 8: 'Divin !', 12: 'Légendaire !', 20: 'Inarrêtable !' },
        rarity: ['Commune', 'Rare', 'Épique', 'Légendaire'], newCard: 'Nouvelle carte !', upgrade: 'Carte améliorée !', unlocked: 'Succès débloqué',
        stats: ['Score', 'Niveau', 'Cartes', 'Succès', 'Meilleur combo'],
        ach: {
          first: ['Premier pas', 'franchir une première diapositive'], combo5: ['En rythme', 'un combo de 5'], combo10: ['Inarrêtable', 'un combo de 10'],
          back: ['Retour vers le futur', 'revenir en arrière'], crit: ['Coup critique', 'un premier critique'], rare: ['Chanceux', 'une carte rare'],
          epic: ['Épique !', 'une carte épique'], legendary: ['Légende vivante', 'une carte légendaire'], chapter: ['Chapitre bouclé', 'finir un chapitre'],
          half: ['Mi-parcours', 'la moitié de la présentation'], end: ['Le bout du tunnel', 'la dernière diapositive'],
          speed: ['Speedrun', 'trois diapositives en quatre secondes'], gamer: ['Joueur invétéré', 'gagner cinq jeux'],
          perfect: ['Perfectionniste', 'un jeu sans faute, avec un « Parfait »'], collector: ['Collectionneur', 'vingt cartes'],
        },
      },
      games: {
        skip: 'Échap : passer', win: 'Bravo !', perfect: 'Parfait !', perfectShort: 'Parfait', good: 'Bien', again: 'Encore !', swish: 'Panier !',
        ouch: 'Aïe !', boom: 'Boum !', combo: 'Combo', wind: 'Vent', words: ['Diapo', 'suivante', 'presque', 'arrivé'], miss: 'Raté !', early: 'Trop tôt !', late: 'Trop lent !', wait: 'Attendez…', fire: 'FEU !',
        taquin: ['Taquin', 'remettez la diapositive suivante en ordre : flèches ou clic · Espace : un coup d\u2019aide'],
        rotate: ['Remettez-la droite', 'flèches pour choisir, Espace pour tourner, ou clic'],
        toss: ['Froissez !', 'Espace ou clic : visez, puis dosez la force -- attention au vent'],
        hero: ['Diapo Hero', '← → (ou clic à gauche / à droite) en rythme ; Espace joue la note la plus proche'],
        slice: ['Tranchez !', 'balayez les morceaux à la souris, ou Espace pour un coup de sabre -- pas la bombe !'],
        run: ['Course', 'Espace, ↑ ou clic pour sauter (maintenez pour aller plus haut) ; passez sous les mots volants'],
        stack: ['Empilez', 'arrêtez chaque bande pile au-dessus de la précédente : Espace, → ou clic'],
        safe: ['Coffre-fort', 'Espace, → ou clic quand la zone verte passe sous le repère'],
        bridge: ['Le pont', 'maintenez Espace, → ou la souris pour allonger le pont, relâchez pour le poser'],
        breakout: ['Casse-briques', 'cassez la moitié de la diapositive : ← → ou la souris'],
        catch: ['Attrapez-la', 'cliquez la miniature, ou Espace quand elle traverse le cercle'],
        mash: ['Poussez !', 'Espace, → ou clic, le plus vite possible'],
        duel: ['Duel', 'au signal FEU !, Espace, → ou clic -- pas avant'],
        memory: ['Memory', 'retrouvez les paires : flèches + Espace, ou clic'],
      },
      sound: ['Son des transitions : coupé', 'Son des transitions : activé (M)'],
      cards: ['Pendant ce temps…', 'Plus tard…', 'Chapitre suivant', 'Et soudain…', 'Quelques instants plus tard',
              'Pendant ce temps, au laboratoire…', 'Mais ce n’est pas tout…', 'Fin de la première bobine', 'L’intrigue se corse…'],
      keys: [
        ['→  Espace  clic à droite', 'étape suivante, puis diapositive suivante'],
        ['←  clic à gauche', 'retour'],
        ['Début  Fin', 'première / dernière diapositive principale'],
        ['12 Entrée   A1 Entrée', 'diapositive 12 / annexe A1'],
        ['O', "vue d'ensemble"],
        ['S', 'vue orateur dans une seconde fenêtre'],
        ['F', 'plein écran'],
        ['D', 'mode rédaction : repères, débordements, problèmes'],
        ['T  Maj+T', 'transitions suivantes / précédentes : aucune, pro, bowling, arcade, cinéma, cartoon, mèmes, chaos, jeux'],
        ['M', 'son des transitions rigolotes, oui / non'],
        ['N', 'afficher le nom de chaque transition (copié en data-fx="..." pour la fixer sur la diapositive)'],
        ['X  Maj+X', 'récompenses : points, combos, niveaux, cartes, succès / tout remettre à zéro'],
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
      ],
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

  /* ---- footer on every slide but .nofoot (kept in the DOM, so it prints) ---- */
  slides.forEach((s, k) => {
    if (s.classList.contains('nofoot')) return;
    const right = make('span');
    if (section[k]) right.append(make('span', { className: 'fsec', textContent: section[k] }));
    right.append(make('span', { className: 'fnum', textContent: posText(k) }));
    s.appendChild(make('div', { className: 'foot' }, make('span', { textContent: deck.dataset.foot || '' }), right));
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

  /* ---- transitions between slides (T / Shift+T cycle the mode) ---------------
     data-transitions on #deck is the deck's default mode; T and Shift+T cycle
     through the modes in the browser, the choice is remembered per file, and a
     speaker view follows:
       off      none
       pro      fades, pushes, wipes -- the sober PowerPoint set
       bowling  what the screens over the lanes play between two frames
       arcade   8-bit: pixels, glitches, a CRT, Pac-Man, Snake, Tetris, a space shooter
       cinema   silent film: countdown leader, curtains, iris, burn, intertitles
       cartoon  splats, puffs of smoke, springs, torn paper, a falling weight
       memes    captions, doge, deal with it, stonks, this is fine, ejected...
       chaos    all five fun sets at once
       games    to move on, win a little game made of the slides (see below); pro otherwise
     One effect is drawn at random per change of slide, never the same twice in
     a row; builds never animate. Nothing runs in print, the speaker view,
     authoring mode or the tools (they place slides without go()), and a
     reduced-motion system starts at off. Web Animations on the real slides,
     plus clipped clones of either slide for the effects that cut one up;
     another key press cuts a running transition short. */
  const FX_MODES = ['off', 'pro', 'bowling', 'arcade', 'cinema', 'cartoon', 'memes', 'chaos', 'games'];
  const FX_FUN = ['bowling', 'arcade', 'cinema', 'cartoon', 'memes'];
  const FX_KEY = 'deck.fx:' + location.pathname;
  const W = 1280, H = 720;
  let fxMode = FX_MODES.includes(deck.dataset.transitions) ? deck.dataset.transitions : 'pro';
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) fxMode = 'off';
  try { const m = localStorage.getItem(FX_KEY); if (FX_MODES.includes(m)) fxMode = m; } catch (_) { /* no storage */ }
  let fxRun = null, fxLast = '', fxForce = null, fxLastAt = 0, fxSkip = false;
  /* N shows the name of every transition as it plays, as the attribute that pins it:
     put data-fx="cartoon:weight" on a <section class="slide"> and that effect always
     plays into the slide (going back: out of it), whatever the T mode, even "off";
     data-fx="none" pins no transition. Deck.fx() lists the names. */
  const FXN_KEY = 'deck.fxnames:' + location.pathname;
  let fxNames = false, fxNameEl = null;
  try { fxNames = localStorage.getItem(FXN_KEY) === '1'; } catch (_) { /* no storage */ }
  function showFxName(key, k) {
    if (!fxNames) return;
    if (!fxNameEl) fxNameEl = document.body.appendChild(make('div', { id: 'fxname' }));
    const pinned = slides[k].dataset.fx === key;
    fxNameEl.textContent = 'slide ' + (k + 1) + ' \u2190 data-fx="' + key + '"' + (pinned ? '  (pinned)' : '');
    fxNameEl.hidden = false;
    try { navigator.clipboard.writeText('data-fx="' + key + '"').catch(() => { /* not allowed */ }); } catch (_) { /* no clipboard */ }
  }
  function setFxNames(on) {
    fxNames = on;
    try { if (on) localStorage.setItem(FXN_KEY, '1'); else localStorage.removeItem(FXN_KEY); } catch (_) { /* no storage */ }
    if (!on && fxNameEl) fxNameEl.hidden = true;
    toast(on ? 'Transition names: shown (N)' : 'Transition names: hidden');
  }
  const FX_CAP = 2400;   // ms: a longer effect plays faster to fit; twice as fast again when the speaker is hurrying
  // a shuffled bag: every item comes out once before any comes back, and never twice running
  const bags = {};
  function draw(key, items) {
    let bag = bags[key];
    if (!bag || !bag.length) {
      bag = bags[key] = shuffle(items.slice());
      if (bag.length > 1 && bag[bag.length - 1] === fxLast) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    return bag.pop();
  }
  const titleOf = k => { const h = slides[k].querySelector('h1'); return h ? h.textContent.replace(/\s+/g, ' ').trim().slice(0, 70) : ''; };

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const sign = () => (Math.random() < 0.5 ? -1 : 1);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const EASE = 'cubic-bezier(.4,0,.2,1)', BACK = 'cubic-bezier(.34,1.56,.64,1)';
  const FALL = 'cubic-bezier(.55,0,1,.45)', RISE = 'cubic-bezier(0,.55,.45,1)';
  // a five-pointed star of outer radius R around the slide centre, turned by a (rad)
  const star = (R, a) => 'polygon(' + Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? R * 0.45 : R, t = a + i * Math.PI / 5;
    return (W / 2 + r * Math.sin(t)).toFixed(1) + 'px ' + (H / 2 - r * Math.cos(t)).toFixed(1) + 'px';
  }).join(',') + ')';
  // a comic-book starburst with n spikes, in % of its box
  const burst = n => 'polygon(' + Array.from({ length: 2 * n }, (_, i) => {
    const r = i % 2 ? rnd(36, 39) : rnd(46, 50), a = i * Math.PI / n;
    return (50 + r * Math.sin(a)).toFixed(1) + '% ' + (50 - r * Math.cos(a)).toFixed(1) + '%';
  }).join(',') + ')';

  /* the sober set: one effect, 0.5-0.9 s, nothing leaves the slide frame */
  const PRO = {
    fade(t) { t.anim(t.inn, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: 'ease' }); },
    fadeThroughBlack(t) {
      t.anim(t.out, [{ opacity: 1 }, { opacity: 0, offset: 0.45 }, { opacity: 0 }], { duration: 900, easing: 'linear' });
      t.anim(t.inn, [{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], { duration: 900, easing: 'linear' });
    },
    push(t) {
      const tr = Math.random() < 0.75 ? p => `translateX(${p * W}px)` : p => `translateY(${p * H}px)`;
      t.anim(t.inn, [{ transform: tr(t.dir) }, { transform: tr(0) }], { duration: 650, easing: EASE });
      t.anim(t.out, [{ transform: tr(0) }, { transform: tr(-t.dir) }], { duration: 650, easing: EASE });
    },
    cover(t) {
      t.anim(t.inn, [{ transform: `translateX(${t.dir * W}px)`, boxShadow: '0 0 40px rgba(0,0,0,.35)' },
                     { transform: 'translateX(0)', boxShadow: '0 0 40px rgba(0,0,0,0)' }], { duration: 600, easing: EASE });
    },
    uncover(t) {
      t.top(t.out);
      t.anim(t.out, [{ transform: 'translateX(0)', boxShadow: '0 0 40px rgba(0,0,0,.35)' },
                     { transform: `translateX(${-t.dir * W}px)`, boxShadow: '0 0 40px rgba(0,0,0,0)' }], { duration: 600, easing: EASE });
    },
    wipe(t) {
      const from = pick(t.dir > 0 ? ['inset(0 100% 0 0)', 'inset(0 0 100% 0)'] : ['inset(0 0 0 100%)', 'inset(100% 0 0 0)']);
      t.anim(t.inn, [{ clipPath: from }, { clipPath: 'inset(0 0 0 0)' }], { duration: 650, easing: EASE });
    },
    split(t) {
      const from = pick(['inset(0 50% 0 50%)', 'inset(50% 0 50% 0)']);
      t.anim(t.inn, [{ clipPath: from }, { clipPath: 'inset(0 0 0 0)' }], { duration: 650, easing: EASE });
    },
    circle(t) {
      t.anim(t.inn, [{ clipPath: `circle(0px at ${W / 2}px ${H / 2}px)` }, { clipPath: `circle(740px at ${W / 2}px ${H / 2}px)` }],
             { duration: 700, easing: EASE });
    },
    zoom(t) {
      t.anim(t.out, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.06)' }], { duration: 550, easing: EASE });
      t.anim(t.inn, [{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 550, easing: EASE });
    },
    blinds(t) {
      const across = Math.random() < 0.5, n = 8, tiles = across ? t.tiles(1, n) : t.tiles(n, 1);
      tiles.forEach(p => {
        const shut = across ? `inset(${p.h}px 0px 0px 0px)` : `inset(0px 0px 0px ${p.w}px)`;
        t.anim(p.el, [{ clipPath: 'inset(0px 0px 0px 0px)' }, { clipPath: shut }],
               { duration: 450, delay: 40 * (across ? p.r : p.c), easing: 'ease-in' });
      });
    },
    dissolve(t) {
      t.tiles(6, 4).forEach(p => t.anim(p.el, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: rnd(0, 420), easing: 'linear' }));
    },
  };

  /* ---- sound for the fun sets (M toggles it; off until asked for) -------------
     Synthesised with Web Audio -- noise and oscillators through a filter and an
     envelope -- so there is no file to ship. The pro set stays silent. */
  const SFX_KEY = 'deck.sfx:' + location.pathname;
  let fxSound = false, audio = null, noiseBuf = null;
  try { fxSound = localStorage.getItem(SFX_KEY) === '1'; } catch (_) { /* no storage */ }
  function ac() {
    if (!audio) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      audio = new C();
      const comp = audio.createDynamicsCompressor();
      comp.connect(audio.destination);
      audio.bus = audio.createGain();
      audio.bus.gain.value = 0.5;
      audio.bus.connect(comp);
      noiseBuf = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }
  // one voice: an oscillator (type) or noise, optionally filtered (and swept), under an attack/decay envelope; at, dur in ms
  function voice(o) {
    const a = ac();
    if (!a) return;
    const t0 = a.currentTime + (o.at || 0) / 1000, dur = (o.dur || 200) / 1000, g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.3, t0 + Math.min(dur * 0.9, o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let src;
    if (o.type === 'noise') {
      src = a.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
    } else {
      src = a.createOscillator();
      src.type = o.type || 'sine';
      src.frequency.setValueAtTime(o.f, t0);
      if (o.f2) src.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
    }
    let node = src;
    if (o.filter) {
      const f = a.createBiquadFilter();
      f.type = o.filter;
      f.frequency.setValueAtTime(o.ff, t0);
      if (o.ff2) f.frequency.exponentialRampToValueAtTime(o.ff2, t0 + dur);
      f.Q.value = o.q || 1;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(a.bus);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }
  const notes = (fs, step, o) => fs.forEach((f, i) => voice(Object.assign({ type: 'square', f, gain: 0.1, dur: step * 1.3, at: i * step }, o)));
  const SOUNDS = {
    roll: ms => { voice({ type: 'noise', filter: 'lowpass', ff: 220, q: 0.7, gain: 0.55, attack: 0.25, dur: ms || 900 });
                  voice({ f: 52, f2: 44, gain: 0.3, attack: 0.2, dur: ms || 900 }); },
    crash: () => {   // pins: a clatter of short woody knocks over a burst
      for (let i = 0; i < 18; i++) voice({ type: 'noise', filter: 'bandpass', ff: rnd(900, 3800), q: 7, gain: rnd(0.3, 0.9), dur: rnd(40, 110), at: 450 * Math.pow(Math.random(), 1.6) });
      voice({ type: 'noise', filter: 'lowpass', ff: 1500, ff2: 300, gain: 0.5, dur: 420 });
    },
    thud: () => { voice({ f: 110, f2: 38, gain: 0.7, dur: 320 }); voice({ type: 'noise', filter: 'lowpass', ff: 400, gain: 0.4, dur: 180 }); },
    clack: () => voice({ type: 'noise', filter: 'bandpass', ff: rnd(2000, 3200), q: 8, gain: 0.5, dur: 28 }),
    whoosh: ms => voice({ type: 'noise', filter: 'bandpass', ff: 300, ff2: 3200, q: 1.2, gain: 0.4, attack: (ms || 400) / 2000, dur: ms || 400 }),
    whistleUp: ms => voice({ f: 380, f2: 1700, gain: 0.18, attack: 0.05, dur: ms || 500 }),
    whistleDown: ms => voice({ f: 1700, f2: 260, gain: 0.18, attack: 0.05, dur: ms || 500 }),
    boing: () => { voice({ type: 'triangle', f: 130, f2: 520, gain: 0.35, dur: 420 }); voice({ type: 'triangle', f: 260, f2: 180, gain: 0.2, dur: 300, at: 380 }); },
    pop: () => voice({ f: 500, f2: 1500, gain: 0.25, dur: 90 }),
    fanfare: () => { notes([523, 659, 784, 1047], 110, { type: 'sawtooth', gain: 0.07 }); voice({ type: 'square', f: 1047, gain: 0.08, dur: 600, at: 440 }); },
    coin: () => { voice({ type: 'square', f: 988, gain: 0.1, dur: 80 }); voice({ type: 'square', f: 1319, gain: 0.1, dur: 380, at: 80 }); },
    blips: () => notes([262, 330, 392, 523, 659, 784], 55),
    jingle: () => notes([392, 523, 659, 784, 659, 784, 1047], 90),
    laser: () => voice({ type: 'square', f: 1600, f2: 180, gain: 0.07, dur: 110 }),
    zap: () => voice({ type: 'sawtooth', f: 120, f2: 1800, gain: 0.1, dur: 160 }),
    bleep: () => voice({ type: 'square', f: 220, f2: 180, gain: 0.08, dur: 45 }),
    waka: ms => { for (let t = 0; t < (ms || 1400); t += 220) { voice({ type: 'triangle', f: 280, f2: 560, gain: 0.25, dur: 110, at: t }); voice({ type: 'triangle', f: 560, f2: 280, gain: 0.25, dur: 110, at: t + 110 }); } },
    glitch: () => { for (let i = 0; i < 9; i++) voice({ type: pick(['square', 'sawtooth']), f: rnd(80, 2000), gain: 0.06, dur: rnd(20, 60), at: rnd(0, 500) }); },
    tubeOff: () => { voice({ f: 9000, f2: 6000, gain: 0.04, dur: 380 }); voice({ type: 'noise', filter: 'lowpass', ff: 700, gain: 0.45, dur: 120, at: 400 }); },
    projector: ms => { for (let t = 0; t < (ms || 1400); t += 42) voice({ type: 'noise', filter: 'highpass', ff: 2600, gain: 0.1, dur: 16, at: t }); },
    beep: () => voice({ f: 1000, gain: 0.2, dur: 90 }),
    crackle: ms => { for (let i = 0; i < 26; i++) voice({ type: 'noise', filter: 'highpass', ff: rnd(1500, 5000), gain: rnd(0.1, 0.4), dur: rnd(8, 25), at: rnd(0, ms || 1200) }); },
    splat: () => { voice({ type: 'noise', filter: 'lowpass', ff: 1000, ff2: 200, gain: 0.8, dur: 260 }); voice({ f: 80, f2: 40, gain: 0.5, dur: 200 }); },
    tear: () => { for (let i = 0; i < 16; i++) voice({ type: 'noise', filter: 'bandpass', ff: rnd(1500, 4200), q: 2, gain: rnd(0.2, 0.5), dur: 30, at: i * 20 }); },
    boom: () => { voice({ f: 70, f2: 38, gain: 0.9, dur: 900 }); voice({ type: 'noise', filter: 'lowpass', ff: 300, gain: 0.5, dur: 250 }); },
    dun: () => [[147, 350], [139, 350], [131, 900]].forEach(([f, d], i) => {
      voice({ type: 'sawtooth', f, gain: 0.12, dur: d, at: i * 300, filter: 'lowpass', ff: 1200 });
      voice({ f: f / 2, gain: 0.3, dur: d, at: i * 300 });
    }),
    airhorn: () => [0, 180, 360].forEach((a, i) => [415, 440, 523].forEach(f =>
      voice({ type: 'sawtooth', f, gain: 0.05, dur: i === 2 ? 600 : 150, at: a, filter: 'lowpass', ff: 3500 }))),
    ding: () => { voice({ f: 880, gain: 0.12, dur: 250 }); voice({ f: 1320, gain: 0.06, dur: 200 }); },
    eerie: ms => { [[440, 0.08], [466, 0.06]].forEach(([f, gain]) => voice({ f, gain, attack: 0.3, dur: ms || 1500 }));
                   voice({ type: 'triangle', f: 880, f2: 660, gain: 0.04, attack: 0.3, dur: ms || 1500 }); },
    riff: () => notes([82, 82, 98, 110, 98, 123, 110], 120, { type: 'sawtooth', gain: 0.1, filter: 'lowpass', ff: 900 }),
    sad: () => [[294, 350], [277, 350], [262, 350], [247, 1000]].forEach(([f, d], i) =>
      voice({ type: 'triangle', f, f2: i === 3 ? 230 : f * 0.97, gain: 0.2, dur: d, at: i * 380 })),
    hum: ms => voice({ f: 60, gain: 0.2, attack: 0.3, dur: ms || 1500 }),
    rewind: () => voice({ type: 'sawtooth', f: 1500, f2: 300, gain: 0.06, dur: 600, filter: 'lowpass', ff: 3000 }),
  };

  /* ---- shared props of the fun sets ---- */
  function dropIn(t, el, delay) {   // falls from above and bounces twice, squashing on the floor
    const f = (y, sx, sy, offset, easing) => ({ transform: `translateY(${y}px) scale(${sx},${sy})`, transformOrigin: '50% 100%', offset, easing });
    t.anim(el, [f(-H - 40, 1, 1, 0, FALL), f(0, 1.05, 0.93, 0.42, RISE), f(-130, 0.98, 1.03, 0.62, FALL),
                f(0, 1.02, 0.97, 0.78, RISE), f(-36, 1, 1, 0.88, FALL), f(0, 1, 1, 1)], { duration: 1150, delay: delay || 0, easing: 'linear' });
  }
  function dropOut(t, el, delay) {   // drops off the bottom, tipping a little
    t.top(el);
    t.anim(el, [{ transform: 'translateY(0px) rotate(0deg)' }, { transform: `translateY(${H + 120}px) rotate(${rnd(-14, 14)}deg)` }],
           { duration: 650, delay: delay || 0, easing: FALL });
  }
  // a bowling ball rolling left to right along y(s), s = 0..1 (a number: a straight line);
  // returns when (ms, delay included) it passes a given x
  function ball(t, duration, y, delay, shrink) {
    const b = t.add(make('div', { className: 'fx-ball' })), x0 = -170, x1 = W + 60, K = 12, spin = rnd(800, 1200);
    const yOf = typeof y === 'function' ? y : () => y;
    delay = delay || 0;
    t.anim(b, Array.from({ length: K + 1 }, (_, i) => {
      const s = i / K;
      return { transform: `translate(${x0 + s * (x1 - x0)}px, ${yOf(s)}px) rotate(${s * spin}deg) scale(${1 - (shrink || 0) * s})` };
    }), { duration, delay, easing: 'linear' });
    return x => delay + Math.max(0, (x - x0 - 60) / (x1 - x0) * duration);
  }
  function fling(t, p, delay, up, spread) {   // thrown up, then falling off the bottom under gravity
    const vx = (p.cx - W / 2) / W * spread + rnd(-160, 160), top = rnd(up * 0.6, up), rot = rnd(-540, 540), s = rnd(0.6, 0.9);
    t.anim(p.el, [{ transform: 'translate(0px,0px) rotate(0deg) scale(1)', easing: 'cubic-bezier(.2,.6,.4,1)' },
                  { transform: `translate(${vx * 0.45}px, ${-top}px) rotate(${rot * 0.45}deg) scale(${(1 + s) / 2})`, offset: 0.35, easing: 'cubic-bezier(.5,0,.9,.6)' },
                  { transform: `translate(${vx}px, ${H + 260 - p.y}px) rotate(${rot}deg) scale(${s})` }],
           { duration: rnd(1000, 1300), delay, easing: 'linear' });
  }
  // a word that pops, holds and blows up: kind '' (bowling), 'x', 'arcade' or 'comic'
  function banner(t, text, delay, o) {
    o = o || {};
    const el = t.add(make('div', { className: 'fx-banner' + (o.kind ? ' fx-' + o.kind : ''), textContent: text }));
    if (o.x !== undefined) { el.style.left = o.x + 'px'; el.style.top = o.y + 'px'; }
    if (o.kind === 'comic') el.style.clipPath = burst(16);
    const tilt = o.tilt === undefined ? rnd(-9, 9) : o.tilt;
    const at = (s, r) => `translate(-50%,-50%) rotate(${r}deg) scale(${s})`;
    t.anim(el, [{ transform: at(0, tilt - 25), opacity: 1 }, { transform: at(1.35, tilt + 4), opacity: 1, offset: 0.2 },
                { transform: at(1, tilt), opacity: 1, offset: 0.32 }, { transform: at(1.06, tilt), opacity: 1, offset: 0.72 },
                { transform: at(2.6, tilt), opacity: 0 }],
           { duration: o.duration || 1500, delay, easing: o.kind === 'arcade' ? 'steps(10, end)' : 'ease-out' });
  }
  // n bits thrown up from (x, y) and falling off the bottom: confetti, or glyphs when text is given
  function confetti(t, x, y, n, delay, cls, text) {
    for (let i = 0; i < n; i++) {
      const el = t.add(make('div', { className: (cls || 'fx-bit') + (text ? '' : ' fx-c' + (i % 6)), textContent: text || '' }));
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      const a = rnd(-Math.PI, 0), v = rnd(200, 620), dx = Math.cos(a) * v, up = -Math.sin(a) * v, rot = rnd(-900, 900);
      const fl = text ? 0 : rnd(900, 2400);   // paper flutters (turns about its own axis); glyphs just spin
      t.anim(el, [{ transform: 'translate(0px,0px) rotate(0deg) rotateX(0deg)', easing: 'cubic-bezier(.2,.7,.4,1)' },
                  { transform: `translate(${dx * 0.6}px, ${-up}px) rotate(${rot * 0.4}deg) rotateX(${fl * 0.35}deg)`, offset: 0.35, easing: 'cubic-bezier(.5,0,.9,.6)' },
                  { transform: `translate(${dx}px, ${H + 60 - y}px) rotate(${rot}deg) rotateX(${fl}deg)` }],
             { duration: rnd(1200, 1800), delay: delay + rnd(0, 90), easing: 'linear' });
    }
  }
  function puff(t, x, y, size, delay, duration) {   // a round cloud that swells and thins out
    const el = t.add(make('div', { className: 'fx-puff' }));
    el.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px`;
    t.anim(el, [{ transform: 'scale(0)', opacity: 1 }, { transform: 'scale(1.25)', opacity: 1, offset: 0.4 },
                { transform: 'scale(1.4)', opacity: 1, offset: 0.6 }, { transform: 'scale(1.6)', opacity: 0 }],
           { duration: duration || 1000, delay, easing: 'ease-out' });
  }
  const PIN = '<svg viewBox="0 0 40 110"><path d="M20 0C28 0 31 8 30 18C29 26 25 30 25 36C25 44 36 58 36 78C36 96 30 108 20 110'
            + 'C10 108 4 96 4 78C4 58 15 44 15 36C15 30 11 26 10 18C9 8 12 0 20 0Z"/><rect x="14" y="24" width="12" height="3"/>'
            + '<rect x="14.5" y="30" width="11" height="3"/></svg>';

  /* the lanes set: 1-2.4 s, anything goes, cheers and confetti on top */
  const CHEERS = ['STRIKE!', 'SPARE!', 'TURKEY!', 'DOUBLE!', 'SPLIT!', 'HAMBONE!', 'X X X', 'PERFECT!', 'BOOM!', '300!', 'WILD THING!',
                  'CLEAN!', 'RE-RACK', 'NEXT FRAME!', 'BAGGER!', 'IN THE POCKET!', 'FOUR-BAGGER!', 'BROOKLYN!'];
  const BOWLING = {
    strike(t) {   // the ball rolls in and the old slide scatters like pins
      t.sfx('roll', 0, 950); t.sfx('crash', 380);
      const y = rnd(420, 560), dy = rnd(-50, 50), when = ball(t, 950, s => y + dy * s);
      t.tiles(4, 3).forEach(p => fling(t, p, when(p.cx) * 0.85, 520, 1500));
      return { cheer: 'STRIKE!', at: 450 };
    },
    pins(t) {   // ten real pins in their triangle; one ball in three leaves the 7-10 split standing
      t.sfx('roll', 0, 1000); t.sfx('crash', 320);
      const cy = rnd(300, 420), when = ball(t, 1000, cy - 60), split = Math.random() < 0.33;
      let k = 0;
      for (let row = 0; row < 4; row++) for (let i = 0; i <= row; i++, k++) {
        const x = 740 + row * 64, y = cy + (i - row / 2) * 60;
        const el = t.add(make('div', { className: 'fx-pin', innerHTML: PIN }));
        el.style.left = (x - 26) + 'px';
        el.style.top = (y - 72) + 'px';
        if (split && (k === 6 || k === 9)) {
          const s = k === 6 ? -1 : 1;
          t.anim(el, [0, 9, -7, 5, -3, 2, 0].map((r, j, a) => ({ transform: `rotate(${s * r}deg)`, transformOrigin: '50% 100%', offset: j / a.length * 0.7 }))
                   .concat([{ transform: `rotate(${s * 95}deg)`, transformOrigin: '50% 100%', offset: 1 }]),
                 { duration: 1700, delay: 500, easing: 'ease-in-out' });
        } else fling(t, { el, cx: x, y: y - 72 }, when(x), 420, 1300);
      }
      dropOut(t, t.out, 850);
      return { cheer: split ? 'SPLIT!' : 'STRIKE!', at: 650 };
    },
    hook(t) {   // a hook ball: it curls towards the pocket, shrinking down the lane
      t.sfx('roll', 0, 1050); t.sfx('crash', 420);
      const y0 = rnd(520, 600), A = rnd(180, 320), when = ball(t, 1050, s => y0 - A * Math.sin(Math.PI * s * 0.8), 0, 0.35);
      t.tiles(5, 3).forEach(p => fling(t, p, when(p.cx) * 0.9, 480, 1400));
      return { cheer: pick(['STRIKE!', 'IN THE POCKET!', 'HOOK!']), at: 550 };
    },
    spare(t) {   // the first ball leaves the bottom row; the second one cleans up
      t.sfx('roll', 0, 850); t.sfx('crash', 60); t.sfx('roll', 700, 800); t.sfx('crash', 760);
      const tiles = t.tiles(4, 3), w1 = ball(t, 850, rnd(90, 200)), w2 = ball(t, 800, rnd(470, 560), 700);
      tiles.forEach(p => fling(t, p, p.r < 2 ? w1(p.cx) : w2(p.cx), 460, 1300));
      return { cheer: 'SPARE!', at: 1150 };
    },
    gutter(t) {   // the old slide rolls off into the gutter, the new one drops in
      t.sfx('roll', 0, 700); t.sfx('thud', 700); t.sfx('thud', 830);
      t.top(t.out);
      const d = t.dir;
      t.anim(t.out, [{ transform: 'translate(0px,0px) rotate(0deg)', easing: 'ease-in' },
                     { transform: `translate(${d * rnd(40, 110)}px, -40px) rotate(${-d * 4}deg)`, offset: 0.25, easing: FALL },
                     { transform: `translate(${d * rnd(220, 420)}px, ${H + 160}px) rotate(${d * rnd(25, 60)}deg)` }], { duration: 800 });
      dropIn(t, t.inn, 350);
      return { cheer: 'GUTTER BALL', at: 150 };
    },
    split(t) {   // the slide splits down the middle; each half teeters, then topples outwards
      t.sfx('crash', 0); t.sfx('thud', 1150);
      const [l, r] = t.pieces([
        { box: { x: 0, y: 0, w: W / 2, h: H }, origin: `0px ${H}px` },
        { box: { x: W / 2, y: 0, w: W / 2, h: H }, origin: `${W / 2}px ${H}px` }]);
      [[l, -1], [r, 1]].forEach(([el, s]) => t.anim(el, [
        { transform: 'translateX(0px) rotate(0deg)' }, { transform: `translateX(${s * 40}px) rotate(0deg)`, offset: 0.25 },
        { transform: `translateX(${s * 40}px) rotate(${-s * 3}deg)`, offset: 0.4 }, { transform: `translateX(${s * 40}px) rotate(${s * 2}deg)`, offset: 0.5, easing: FALL },
        { transform: `translateX(${s * 40}px) rotate(${s * 95}deg)` }], { duration: 1300, easing: 'ease-in-out' }));
      return { cheer: 'SPLIT!', at: 200 };
    },
    turkey(t) {   // three strikes in a row: X, X, X, TURKEY!
      [120, 380, 640].forEach(a => t.sfx('thud', a + 60)); t.sfx('thud', 1530);
      [W / 4, W / 2, 3 * W / 4].forEach((x, i) => banner(t, 'X', 120 + i * 260, { kind: 'x', x, y: rnd(300, 420), duration: 1300 }));
      dropOut(t, t.out, 950);
      dropIn(t, t.inn, 1050);
      return { cheer: 'TURKEY!', at: 1050 };
    },
    scoreboard(t) {   // a split-flap board: the old slide flaps away tile by tile, the new one flaps in
      for (let i = 0; i < 18; i++) t.sfx('clack', rnd(0, 900));
      const outs = t.tiles(6, 3), ins = t.tiles(6, 3, 'in'), flap = 260;
      const lag = p => p.c * 60 + p.r * 40 + rnd(0, 60);
      outs.forEach(p => t.anim(p.el, [{ transform: 'perspective(900px) rotateX(0deg)', filter: 'brightness(1)' },
                                      { transform: 'perspective(900px) rotateX(-90deg)', filter: 'brightness(.5)' }], { duration: flap, delay: lag(p), easing: 'ease-in' }));
      ins.forEach(p => t.anim(p.el, [{ transform: 'perspective(900px) rotateX(90deg)', filter: 'brightness(.5)' },
                                     { transform: 'perspective(900px) rotateX(0deg)', filter: 'brightness(1)' }], { duration: flap, delay: 380 + lag(p), easing: 'ease-out' }));
      t.anim(t.inn, [{ opacity: 0 }, { opacity: 0 }], { duration: 380 + 5 * 60 + 2 * 40 + 60 + flap });
    },
    lane(t) {   // the old slide lies down and slides away down the lane; the new one stands up
      t.sfx('roll', 0, 1100); t.sfx('whoosh', 750, 500);
      t.anim(t.out, [{ transform: 'perspective(1000px) rotateX(0deg) translateY(0px)', transformOrigin: '50% 100%', opacity: 1 },
                     { transform: 'perspective(1000px) rotateX(62deg) translateY(0px)', transformOrigin: '50% 100%', opacity: 1, offset: 0.35 },
                     { transform: `perspective(1000px) rotateX(62deg) translateY(${-3.5 * H}px)`, transformOrigin: '50% 100%', opacity: 0 }],
             { duration: 1000, easing: 'ease-in' });
      t.anim(t.inn, [{ transform: 'perspective(1000px) rotateX(90deg)', transformOrigin: '50% 100%' },
                     { transform: 'perspective(1000px) rotateX(0deg)', transformOrigin: '50% 100%' }], { duration: 700, delay: 750, easing: BACK });
    },
    pinsetter(t) {   // the sweep bar comes down and clears the deck
      t.sfx('whoosh', 0, 450); t.sfx('thud', 450); t.sfx('whoosh', 600, 700);
      const bar = t.add(make('div', { className: 'fx-sweep' })), D = 1300, y = H - 80;
      t.top(t.out);
      t.anim(bar, [{ transform: 'translateY(-120px)', easing: 'ease-out' }, { transform: `translateY(${y}px)`, offset: 0.35 },
                   { transform: `translateY(${y}px)`, offset: 0.45, easing: 'ease-in' }, { transform: `translateY(${y - H - 100}px)` }], { duration: D, easing: 'linear' });
      t.anim(t.out, [{ transform: 'translateY(0px)' }, { transform: 'translateY(0px)', offset: 0.45, easing: 'ease-in' },
                     { transform: `translateY(${-H - 100}px)` }], { duration: D, easing: 'linear' });
    },
    wobbler(t) {   // the slide wobbles like a pin that will not go down -- and then it does
      [150, 380, 600, 800].forEach(a => t.sfx('clack', a)); t.sfx('thud', 1650);
      t.top(t.out);
      const s = t.dir, rs = [0, 7, -6, 5, -4, 3, -2, 1.5];
      t.anim(t.out, rs.map((r, i) => ({ transform: `rotate(${s * r}deg)`, transformOrigin: '50% 100%', offset: i / rs.length * 0.7 }))
                    .concat([{ transform: `rotate(${s * 1}deg)`, transformOrigin: '50% 100%', offset: 0.7, easing: FALL },
                             { transform: `rotate(${s * 95}deg)`, transformOrigin: '50% 100%', offset: 1 }]), { duration: 1700, easing: 'ease-in-out' });
      return { cheer: 'WOBBLER!', at: 1150 };
    },
    fireworks(t) {
      for (let i = 0; i < 4; i++) { t.sfx('pop', i * 260); t.sfx('crackle', i * 260 + 80, 500); }
      t.anim(t.inn, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 250, easing: 'ease' });
      for (let i = 0; i < 4; i++) {
        const x = rnd(200, W - 200), y = rnd(180, 460), d = i * 260;
        confetti(t, x, y, 40, d);
        const f = t.add(make('div', { className: 'fx-flash' }));
        t.anim(f, [{ opacity: 0 }, { opacity: 0.35 }, { opacity: 0 }], { duration: 200, delay: d });
      }
    },
    bounce(t) {
      [480, 895, 1150].forEach(a => t.sfx('thud', a));
      dropIn(t, t.inn, 0);
    },
    tornado(t) {
      t.sfx('whoosh', 0, 1100);
      const s = sign();
      t.anim(t.out, [{ transform: 'rotate(0deg) scale(1)' }, { transform: `rotate(${-s * 540}deg) scale(0)` }], { duration: 600, easing: 'ease-in' });
      t.anim(t.inn, [{ transform: `rotate(${s * rnd(720, 1440)}deg) scale(0)` }, { transform: 'rotate(0deg) scale(1)' }], { duration: 850, delay: 420, easing: BACK });
    },
    flip(t) {
      t.sfx('whoosh', 0, 420); t.sfx('clack', 1100);
      const ax = pick(['X', 'Y']), s = sign() * t.dir;
      t.anim(t.out, [{ transform: `perspective(1600px) rotate${ax}(0deg)` }, { transform: `perspective(1600px) rotate${ax}(${s * 90}deg)` }], { duration: 420, easing: 'ease-in' });
      t.anim(t.inn, [{ transform: `perspective(1600px) rotate${ax}(${-s * 90}deg)` }, { transform: `perspective(1600px) rotate${ax}(0deg)` }], { duration: 700, delay: 420, easing: BACK });
    },
    cube(t) {
      t.sfx('whoosh', 0, 1000);
      const d = t.dir, ease = 'cubic-bezier(.6,-0.25,.35,1.3)';
      const oo = d > 0 ? '100% 50%' : '0% 50%', io = d > 0 ? '0% 50%' : '100% 50%';
      t.anim(t.out, [{ transform: 'perspective(1800px) translateX(0px) rotateY(0deg)', transformOrigin: oo },
                     { transform: `perspective(1800px) translateX(${-d * W}px) rotateY(${-d * 90}deg)`, transformOrigin: oo }], { duration: 1000, easing: ease });
      t.anim(t.inn, [{ transform: `perspective(1800px) translateX(${d * W}px) rotateY(${d * 90}deg)`, transformOrigin: io },
                     { transform: 'perspective(1800px) translateX(0px) rotateY(0deg)', transformOrigin: io }], { duration: 1000, easing: ease });
    },
    jelly(t) {
      t.sfx('boing', 0);
      const f = (sx, sy, offset, o) => ({ transform: `scale(${sx},${sy})`, opacity: o === undefined ? 1 : o, offset });
      t.anim(t.inn, [f(0.05, 0.05, 0, 0), f(1.25, 0.75, 0.3), f(0.8, 1.2, 0.45), f(1.12, 0.9, 0.6), f(0.95, 1.05, 0.75), f(1.02, 0.98, 0.88), f(1, 1, 1)],
             { duration: 1100, easing: 'ease-in-out' });
    },
    disco(t) {   // hue spins and negative flashes while the slide shakes into place
      t.sfx('zap', 0); t.sfx('blips', 150);
      const n = 9;
      t.anim(t.inn, Array.from({ length: n + 1 }, (_, i) => i === n
        ? { filter: 'hue-rotate(0deg) invert(0) saturate(1)', transform: 'translate(0px,0px) rotate(0deg)' }
        : { filter: `hue-rotate(${i * 80}deg) invert(${i % 2}) saturate(${rnd(2, 5).toFixed(1)})`,
            transform: `translate(${rnd(-26, 26)}px, ${rnd(-18, 18)}px) rotate(${rnd(-3, 3)}deg)` }), { duration: 1100, easing: 'linear' });
      const flash = t.add(make('div', { className: 'fx-flash' }));
      t.anim(flash, [{ opacity: 0.9 }, { opacity: 0 }], { duration: 350, easing: 'ease-out' });
    },
    shatter(t) {   // the old slide breaks into tiles that fall in no particular order
      t.sfx('crash', 0); t.sfx('crash', 350);
      t.tiles(6, 4).forEach(p => {
        const rot = rnd(-200, 200), dx = rnd(-120, 120);
        t.anim(p.el, [{ transform: 'translate(0px,0px) rotate(0deg)' }, { transform: `translate(${dx}px, ${H + 200 - p.y}px) rotate(${rot}deg)` }],
               { duration: rnd(700, 1000), delay: rnd(0, 550), easing: 'cubic-bezier(.55,0,1,.6)' });
      });
    },
    starIris(t) {
      t.sfx('whistleUp', 0, 900);
      const s = sign(), k = 8;
      t.anim(t.inn, Array.from({ length: k + 1 }, (_, i) => ({ clipPath: star(1750 * Math.pow(i / k, 1.6), s * i * 0.55) })),
             { duration: 1100, easing: 'ease-in' });
      t.anim(t.inn, [{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 1100, easing: 'ease-out', composite: 'add' });
    },
    slot(t) {   // spins like a fruit machine, then lands with a jolt
      t.sfx('projector', 0, 780); t.sfx('coin', 1150);
      t.clip();
      const spins = 3 + Math.floor(rnd(0, 3)), sp = 0.6 / spins, fr = [];
      for (let i = 0; i < spins; i++) {
        fr.push({ transform: `translateY(${-H}px)`, filter: 'blur(14px)', offset: i * sp },
                { transform: `translateY(${H}px)`, filter: 'blur(14px)', offset: (i + 1) * sp - 0.001 });
      }
      fr.push({ transform: `translateY(${-H}px)`, filter: 'blur(8px)', offset: 0.6, easing: 'cubic-bezier(.3,1.7,.5,1)' },
              { transform: 'translateY(0px)', filter: 'blur(0px)', offset: 1 });
      t.anim(t.out, [{ transform: 'translateY(0px)', filter: 'blur(0px)' }, { transform: `translateY(${H}px)`, filter: 'blur(12px)' }], { duration: 200, easing: 'ease-in' });
      t.anim(t.inn, fr, { duration: 1300, easing: 'linear' });
    },
    pinball(t) {   // a small copy ricochets round the frame, then snaps to full size
      for (let i = 1; i <= 5; i++) t.sfx('pop', i * 1400 / 7); t.sfx('coin', 1300);
      let r = 0;
      const at = (x, y, s) => `translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})`;
      const fr = [{ transform: at(-t.dir * 900, rnd(-220, 220), 0.3) }];
      for (let i = 0; i < 5; i++) {
        r += rnd(90, 200) * (i % 2 ? 1 : -1);
        fr.push({ transform: at(rnd(-440, 440), (i % 2 ? 1 : -1) * rnd(120, 250), 0.3) });
      }
      r = 0;
      fr[fr.length - 1].easing = BACK;
      fr.push({ transform: at(0, 0, 1) });
      t.anim(t.inn, fr, { duration: 1400, easing: 'linear' });
    },
    drain(t) {   // the old slide spirals down a corner, uncovering the new one
      t.sfx('whistleDown', 0, 1100);
      t.top(t.out);
      const cx = sign() * W / 2, cy = sign() * H / 2;
      t.anim(t.out, [{ transform: 'translate(0px,0px) rotate(0deg) scale(1)' }, { transform: `translate(${cx}px, ${cy}px) rotate(${sign() * 1080}deg) scale(0)` }],
             { duration: 1100, easing: 'cubic-bezier(.6,0,.9,.5)' });
    },
    flash(t) {   // white flash, then the new slide shakes in
      t.sfx('zap', 200); t.sfx('thud', 360);
      const flash = t.add(make('div', { className: 'fx-flash' }));
      t.anim(flash, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.42 }, { opacity: 0 }], { duration: 900, easing: 'ease-out' });
      t.showAt(t.inn, 0.4, 900);
      t.anim(t.inn, Array.from({ length: 9 }, (_, i) => ({
        transform: i < 3 || i === 8 ? 'translate(0px,0px)' : `translate(${rnd(-30, 30)}px, ${rnd(-20, 20)}px)` })), { duration: 900, easing: 'linear', composite: 'add' });
    },
  };

  /* the arcade set: 8-bit, steps rather than easing */
  const ARCADE_CHEERS = ['LEVEL UP!', 'PRESS START', '1UP', 'HIGH SCORE!', 'COMBO x3', 'READY?', 'K.O.!', 'BONUS!', 'GAME OVER',
                         'INSERT COIN', 'NEW RECORD!', 'CONTINUE?', 'STAGE CLEAR', 'x2 MULTIPLIER', 'FATALITY'];
  // a route through every cell of a C x R grid: a spiral inwards, or a zig-zag by rows or by columns, from any corner
  function snakePath(C, R) {
    const p = [], kind = pick(['spiral', 'rows', 'cols']);
    if (kind === 'spiral') {
      let top = 0, bottom = R - 1, left = 0, right = C - 1;
      while (top <= bottom && left <= right) {
        for (let c = left; c <= right; c++) p.push([c, top]);
        top++;
        for (let r = top; r <= bottom; r++) p.push([right, r]);
        right--;
        if (top <= bottom) { for (let c = right; c >= left; c--) p.push([c, bottom]); bottom--; }
        if (left <= right) { for (let r = bottom; r >= top; r--) p.push([left, r]); left++; }
      }
    } else if (kind === 'rows') for (let r = 0; r < R; r++) for (let i = 0; i < C; i++) p.push([r % 2 ? C - 1 - i : i, r]);
    else for (let c = 0; c < C; c++) for (let i = 0; i < R; i++) p.push([c, c % 2 ? R - 1 - i : i]);
    const fx = Math.random() < 0.5, fy = Math.random() < 0.5;
    return p.map(([c, r]) => [fx ? C - 1 - c : c, fy ? R - 1 - r : r]);
  }
  const ARCADE = {
    snake(t) {   // Snake eats the old slide cell by cell; where it has been, the new slide shows through
      const C = 10, R = 6, cw = W / C, ch = H / R, path = snakePath(C, R), n = path.length, step = 20, D = n * step + 250;
      const foods = [8, 20, 32, 44, 56].filter(i => i < n);
      const lens = path.map((_, st) => Math.min(15, 3 + 2 * foods.filter(f => f <= st).length)), maxLen = lens[n - 1];
      const at = st => st * step / D, cell = ([c, r]) => `M${c * cw} ${r * ch}h${cw}v${ch}h${-cw}Z`;
      let eaten = '';
      const clip = path.map((q, st) => { eaten += cell(q); return { clipPath: `path("${eaten}")`, offset: at(st), easing: 'steps(1, end)' }; });
      t.anim(t.inn, clip.concat([{ clipPath: `path("${eaten}")`, offset: 1 }]), { duration: D, easing: 'linear' });
      foods.forEach(f => {
        const apple = t.add(make('div', { className: 'fx-apple' })), [c, r] = path[f];
        apple.style.left = (c * cw + cw / 2 - 32) + 'px';
        apple.style.top = (r * ch + ch / 2 - 32) + 'px';
        t.during(apple, at(Math.max(0, f - 10)), at(f), D);
        t.sfx('coin', at(f) * D);
      });
      for (let j = maxLen - 1; j >= 0; j--) {   // the tail first, so the head is drawn on top
        const seg = t.add(make('div', { className: 'fx-snake' + (j === 0 ? ' head' : '') }));
        const fr = path.map((_, st) => {
          const [c, r] = path[Math.max(0, st - j)];
          return { transform: `translate(${c * cw + 5}px, ${r * ch + 5}px)`, opacity: st >= j && j < lens[st] ? 1 : 0, offset: at(st), easing: 'steps(1, end)' };
        });
        t.anim(seg, fr.concat([Object.assign({}, fr[n - 1], { offset: 1 })]), { duration: D, easing: 'linear' });
      }
      for (let st = 0; st < n; st += 3) t.sfx('bleep', at(st) * D);
      return { cheer: 'SCORE ' + foods.length * 100, at: D - 350 };
    },
    stage(t) {   // a level card: STAGE <slide number>, the slide's title, READY?
      const D = 1500, card = t.add(make('div', { className: 'fx-stage' },
        make('b', { textContent: 'STAGE ' + label[t.to] }), make('span', { textContent: (titleOf(t.to) || '').toUpperCase() }), make('i', { textContent: 'READY?' })));
      t.sfx('jingle', 100);
      t.anim(card, [{ clipPath: 'inset(50% 0% 50% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', offset: 0.12 }, { clipPath: 'inset(0% 0% 0% 0%)', offset: 0.82 },
                    { clipPath: 'inset(50% 0% 50% 0%)' }], { duration: D, easing: 'steps(1, end)' });
      t.anim(card.querySelector('i'), Array.from({ length: 9 }, (_, i) => ({ opacity: i % 2, easing: 'steps(1, end)' })), { duration: D * 0.7, delay: D * 0.12 });
      t.hideAt(t.out, 0.12, D);
      return { cheer: '' };
    },
    pixels(t) {   // the screen fills with coloured blocks, then they clear off the new slide
      t.sfx('blips', 0); t.sfx('blips', 500);
      const D = 1000;
      for (let r = 0; r < 9; r++) for (let c = 0; c < 16; c++) {
        const el = t.add(make('div', { className: 'fx-px fx-c' + Math.floor(rnd(0, 7)) }));
        el.style.left = c * 80 + 'px';
        el.style.top = r * 80 + 'px';
        const a = rnd(0.02, 0.45), b = rnd(0.55, 0.97);
        t.anim(el, [{ opacity: 0 }, { opacity: 0, offset: a }, { opacity: 1, offset: a + 0.005 }, { opacity: 1, offset: b },
                    { opacity: 0, offset: b + 0.005 }, { opacity: 0 }], { duration: D, easing: 'linear' });
      }
      t.hideAt(t.out, 0.5, D);
      t.showAt(t.inn, 0.5, D);
    },
    glitch(t) {   // torn scanlines, colour shifts, the new slide jittering into sync
      t.sfx('glitch', 0); t.sfx('glitch', 400);
      const D = 900;
      const band = () => { const a = rnd(0, 85); return `inset(${a.toFixed(0)}% 0% ${Math.max(0, 100 - a - rnd(6, 35)).toFixed(0)}% 0%)`; };
      const jit = (torn, clean) => ({
        clipPath: clean ? 'inset(0% 0% 0% 0%)' : torn ? band() : 'inset(0% 0% 0% 0%)',
        transform: `translateX(${clean ? 0 : rnd(-70, 70).toFixed(0)}px)`,
        filter: `hue-rotate(${clean ? 0 : rnd(0, 360).toFixed(0)}deg) saturate(${clean ? 1 : rnd(1, 5).toFixed(1)})`,
        easing: 'steps(1, end)' });
      t.anim(t.out, Array.from({ length: 6 }, (_, i) => jit(i % 2, false))
        .concat([{ clipPath: 'inset(0% 0% 100% 0%)', transform: 'translateX(0px)', filter: 'hue-rotate(0deg) saturate(1)' }]), { duration: D * 0.45, easing: 'linear' });
      t.anim(t.inn, [{ clipPath: 'inset(0% 0% 100% 0%)', transform: 'translateX(0px)', filter: 'hue-rotate(0deg) saturate(1)', easing: 'steps(1, end)' }]
        .concat(Array.from({ length: 7 }, (_, i) => jit(i % 2 === 0, i === 6))), { duration: D * 0.6, delay: D * 0.4, easing: 'linear' });
      [-1, 1].forEach(s => {
        const ghost = t.clone('in');
        t.anim(ghost, Array.from({ length: 7 }, (_, i) => ({
          opacity: i === 0 || i === 6 ? 0 : rnd(0.25, 0.6), transform: `translateX(${s * rnd(8, 22).toFixed(0)}px)`,
          filter: `hue-rotate(${s * 110}deg) saturate(3)`, easing: 'steps(1, end)' })), { duration: D * 0.6, delay: D * 0.4, easing: 'linear' });
      });
    },
    crt(t) {   // an old tube switching off to a line, a dot -- and back on
      t.sfx('tubeOff', 0);
      const D = 1100, f = (sx, sy, b, offset) => ({ transform: `scale(${sx},${sy})`, filter: `brightness(${b})`, offset });
      t.anim(t.out, [f(1, 1, 1, 0), f(1, 0.006, 4, 0.3), f(0.002, 0.006, 8, 0.45), f(0.002, 0.006, 8, 1)], { duration: D, easing: 'ease-in' });
      t.anim(t.inn, [f(0.002, 0.006, 8, 0), f(0.002, 0.006, 8, 0.55), f(1, 0.006, 4, 0.72), f(1, 1, 1, 1)], { duration: D, easing: 'ease-out' });
    },
    pacman(t) {   // Pac-Man eats the old slide, pellets first, a ghost on his heels
      t.sfx('waka', 0, 1500);
      const d = t.dir, S = 300, D = 1500, y = H / 2;
      const xa = d > 0 ? -S : W, xb = d > 0 ? W + 40 : -S - 40;   // his left edge, start and end
      const sOf = X => (X - S / 2 - xa) / (xb - xa);                  // when his centre is at X
      for (let i = 0; i < 10; i++) {
        const x = 64 + i * 128, el = t.add(make('div', { className: 'fx-pellet' })), s = sOf(x);
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        t.anim(el, [{ opacity: 1 }, { opacity: 1, offset: s }, { opacity: 0, offset: s + 0.001 }, { opacity: 0 }], { duration: D, easing: 'linear' });
      }
      const [c0, c1] = d > 0 ? [0, W] : [W, 0], eat = a => d > 0 ? `inset(0px 0px 0px ${a}px)` : `inset(0px ${W - a}px 0px 0px)`;
      t.anim(t.out, [{ clipPath: eat(c0) }, { clipPath: eat(c0), offset: sOf(c0) }, { clipPath: eat(c1), offset: sOf(c1) }, { clipPath: eat(c1) }],
             { duration: D, easing: 'linear' });
      const walk = (el, delay) => t.anim(el, [{ transform: `translateX(${xa}px) scaleX(${d})` }, { transform: `translateX(${xb}px) scaleX(${d})` }],
                                         { duration: D, delay, easing: 'linear' });
      const pac = t.add(make('div', { className: 'fx-pac' }, make('i'), make('i')));
      pac.style.top = (y - S / 2) + 'px';
      walk(pac, 0);
      const chomp = { duration: 110, iterations: Math.round(D / 110), direction: 'alternate', easing: 'ease-in-out' };
      t.anim(pac.children[0], [{ transform: 'rotate(-40deg)' }, { transform: 'rotate(0deg)' }], chomp);
      t.anim(pac.children[1], [{ transform: 'rotate(40deg)' }, { transform: 'rotate(0deg)' }], chomp);
      const ghost = t.add(make('div', { className: 'fx-ghost' }));
      ghost.style.top = (y - 130) + 'px';
      ghost.style.setProperty('--g', `var(--fx-${pick([1, 3, 5, 6])})`);
      walk(ghost, 380);
      return { cheer: pick(['WAKA WAKA', '1UP', 'BONUS!']), at: 600 };
    },
    tetris(t) {   // the new slide falls in as blocks, bottom row first, one cell at a time
      for (let i = 0; i < 15; i++) t.sfx('bleep', i * 70 + 380); t.sfx('blips', 1400);
      t.clip();
      const tiles = t.tiles(5, 3, 'in'), drop = 380, gap = 70;
      const order = [2, 1, 0].flatMap(r => shuffle(tiles.filter(p => p.r === r)));
      order.forEach((p, i) => t.anim(p.el, [{ transform: `translateY(${-(p.y + p.h + 20)}px)` }, { transform: 'translateY(0px)' }],
                                     { duration: drop, delay: i * gap, easing: 'steps(6, end)' }));
      const total = (order.length - 1) * gap + drop;
      t.anim(t.inn, [{ opacity: 0 }, { opacity: 0 }], { duration: total });
      const f = t.add(make('div', { className: 'fx-flash' }));
      t.anim(f, [{ opacity: 0 }, { opacity: 0.8 }, { opacity: 0 }], { duration: 220, delay: total - 60 });
      return { cheer: pick(['LINE CLEAR!', 'TETRIS!']), at: total - 200 };
    },
    shooter(t) {   // a ship at the bottom shoots the old slide to pieces
      for (let i = 0; i < 24; i++) t.sfx('laser', i * 42 + 20);
      const tiles = shuffle(t.tiles(6, 4)), gap = 42, D = tiles.length * gap + 300, top = H - 84;
      tiles.forEach((p, i) => {
        const at = i * gap + 20;
        const laser = t.add(make('div', { className: 'fx-laser' }));
        laser.style.cssText = `left:${p.cx - 3}px;top:${p.cy}px;height:${top - p.cy}px`;
        t.anim(laser, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 80, delay: at });
        t.anim(p.el, [{ transform: 'scale(1)', filter: 'brightness(1)', opacity: 1 }, { transform: 'scale(1.12)', filter: 'brightness(3)', opacity: 1, offset: 0.3 },
                      { transform: 'scale(0)', filter: 'brightness(3)', opacity: 0 }], { duration: 200, delay: at + 50, easing: 'steps(4, end)' });
        confetti(t, p.cx, p.cy, 5, at + 50, 'fx-bit fx-sq');
      });
      const ship = t.add(make('div', { className: 'fx-ship' }));
      ship.style.top = top + 'px';
      t.anim(ship, [{ transform: `translateX(${W / 2 - 45}px)` }]
        .concat(tiles.map((p, i) => ({ transform: `translateX(${p.cx - 45}px)`, offset: (i * gap + 20) / D })))
        .concat([{ transform: `translateX(${W / 2 - 45}px)` }]), { duration: D, easing: 'linear' });
      return { cheer: pick(['HIGH SCORE!', 'STAGE CLEAR', 'PERFECT!']), at: D - 300 };
    },
  };

  /* the silent-film set: sepia, flicker, and the cards in the deck's language */
  const CINEMA = {
    countdown(t) {   // the film leader: 3, 2, 1, the hand sweeping round
      t.sfx('projector', 0, 1500); t.sfx('beep', 0.35 * 1500);
      const D = 1500, L = t.add(make('div', { className: 'fx-leader' },
        make('i', { className: 'c1' }), make('i', { className: 'c2' }), make('i', { className: 'h' }), make('i', { className: 'v' }), make('b')));
      const offs = [0, 0.08, 0.2, 0.32, 0.44, 0.56, 0.68, 0.8, 0.86, 1];
      t.anim(L, offs.map((offset, i) => ({ offset, opacity: i === 0 || i === offs.length - 1 ? 0 : 1, filter: `brightness(${rnd(0.85, 1.2).toFixed(2)})` })),
             { duration: D, easing: 'linear' });
      t.anim(L.querySelector('b'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: D * 0.25, delay: D * 0.1, iterations: 3, easing: 'linear' });
      [3, 2, 1].forEach((n, i) => {
        const el = L.appendChild(make('span', { textContent: n })), a = 0.1 + i * 0.25, b = a + 0.25;
        t.anim(el, [{ opacity: 0 }, { opacity: 0, offset: a }, { opacity: 1, offset: a + 0.001 }, { opacity: 1, offset: b },
                    { opacity: 0, offset: b + 0.001 }, { opacity: 0 }], { duration: D, easing: 'linear' });
      });
      t.hideAt(t.out, 0.08, D);
    },
    curtain(t) {   // the red curtains close on the old slide and open on the new one
      t.sfx('whoosh', 0, 570); t.sfx('whoosh', 870, 630);
      const D = 1500, off = 720;
      const L = t.add(make('div', { className: 'fx-curtain l' })), R = t.add(make('div', { className: 'fx-curtain r' }));
      const V = t.add(make('div', { className: 'fx-valance' }));
      [[L, -1], [R, 1]].forEach(([el, s]) => t.anim(el, [
        { transform: `translateX(${s * off}px) scaleX(.7)` }, { transform: 'translateX(0px) scaleX(1)', offset: 0.38 },
        { transform: 'translateX(0px) scaleX(1)', offset: 0.58 }, { transform: `translateX(${s * off}px) scaleX(.7)` }], { duration: D, easing: 'ease-in-out' }));
      t.anim(V, [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0%)', offset: 0.2 }, { transform: 'translateY(0%)', offset: 0.85 },
                 { transform: 'translateY(-100%)' }], { duration: D });
      t.hideAt(t.out, 0.4, D);
    },
    iris(t) {   // the iris closes on a point of the old slide and opens there on the new one
      t.sfx('projector', 0, 1400);
      const D = 1400, x = rnd(420, 860), y = rnd(250, 470), c = r => `circle(${r}px at ${x.toFixed(0)}px ${y.toFixed(0)}px)`;
      t.top(t.out);
      t.anim(t.out, [{ clipPath: c(1500), filter: 'sepia(0)' }, { clipPath: c(0), filter: 'sepia(1)', offset: 0.45 }, { clipPath: c(0), filter: 'sepia(1)' }],
             { duration: D, easing: 'ease-in' });
      t.anim(t.inn, [{ clipPath: c(0), filter: 'sepia(1)' }, { clipPath: c(0), filter: 'sepia(1)', offset: 0.55 }, { clipPath: c(1500), filter: 'sepia(0)' }],
             { duration: D, easing: 'ease-out' });
    },
    burn(t) {   // the film jams in the gate and burns through
      t.sfx('projector', 0, 400); t.sfx('crackle', 300, 1100);
      const D = 1400, x = rnd(300, 980), y = rnd(200, 520), K = 10;
      t.top(t.out);
      const rs = Array.from({ length: K + 1 }, (_, i) => 0.5 + 1600 * Math.pow(i / K, 2.2)), n = v => v.toFixed(1);
      const hole = r => `path(evenodd, "M0 0H${W}V${H}H0Z M${n(x - r)} ${n(y)} a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0 a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z")`;
      t.anim(t.out, rs.map((r, i) => ({ clipPath: hole(r), filter: `sepia(${(i / K).toFixed(2)}) brightness(${(1 + 0.5 * i / K).toFixed(2)})` })),
             { duration: D, easing: 'linear' });
      const ring = t.add(make('div', { className: 'fx-burn' }));
      ring.style.left = (x - 100) + 'px';
      ring.style.top = (y - 100) + 'px';
      t.anim(ring, rs.map((r, i) => ({ transform: `scale(${(r / 58).toFixed(3)})`, opacity: i < 0.75 * K ? 1 : 0 })), { duration: D, easing: 'linear' });
    },
    filmstrip(t) {   // both slides shrink into frames of a film strip that runs through the gate
      t.sfx('projector', 0, 1500);
      t.clip();
      const D = 1500, d = t.dir, s = 0.78, gap = 0.86 * H, film = t.under(make('div', { className: 'fx-film' }));
      const ty = (y, sc) => `translateY(${y}px) scale(${sc})`, o = { duration: D, easing: 'ease-in-out' };
      t.anim(t.out, [{ transform: ty(0, 1) }, { transform: ty(0, s), offset: 0.25 }, { transform: ty(-d * gap, s), offset: 0.7 }, { transform: ty(-d * gap, s) }], o);
      t.anim(t.inn, [{ transform: ty(d * gap, s) }, { transform: ty(d * gap, s), offset: 0.25 }, { transform: ty(0, s), offset: 0.7 }, { transform: ty(0, 1) }], o);
      t.anim(film, [{ opacity: 0, transform: 'translateY(0px)' }, { opacity: 1, transform: 'translateY(0px)', offset: 0.2 },
                    { opacity: 1, transform: 'translateY(0px)', offset: 0.25 }, { opacity: 1, transform: `translateY(${-d * gap}px)`, offset: 0.7 },
                    { opacity: 1, transform: `translateY(${-d * gap}px)`, offset: 0.78 }, { opacity: 0, transform: `translateY(${-d * gap}px)` }], o);
    },
    intertitle(t) {   // a title card, as in the pictures
      t.sfx('projector', 0, 1800);
      const D = 1800, title = titleOf(t.to), b = make('b', {}, make('small', { textContent: pick(T.cards) }));
      if (title && Math.random() < 0.7) b.append(make('span', { textContent: title }));
      else b.firstChild.className = 'solo';
      const card = t.add(make('div', { className: 'fx-card' }, b));
      const offs = [0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.84, 1];
      t.anim(card, offs.map((offset, i) => ({ offset, opacity: i === 0 || i === offs.length - 1 ? 0 : 1,
                                              filter: `brightness(${rnd(0.8, 1.2).toFixed(2)})` })), { duration: D, easing: 'linear' });
      t.hideAt(t.out, 0.12, D);
    },
  };
  function grain(t, D) {   // vignette flicker and a few scratches running down the film
    const g = t.add(make('div', { className: 'fx-grain' }));
    t.anim(g, Array.from({ length: 10 }, (_, i) => ({ opacity: i === 0 || i === 9 ? 0 : rnd(0.5, 1) })), { duration: D, easing: 'linear' });
    for (let i = 0; i < 3; i++) {
      const s = t.add(make('div', { className: 'fx-scratch' })), x = rnd(80, W - 80);
      s.style.left = x + 'px';
      t.anim(s, Array.from({ length: 8 }, (_, j) => ({ opacity: j === 7 ? 0 : rnd(0, 0.8), transform: `translateX(${rnd(-30, 30).toFixed(0)}px)`,
                                                       easing: 'steps(1, end)' })), { duration: D, easing: 'linear' });
    }
  }

  /* the cartoon set: squash, stretch, and comic-book noises */
  const COMIC = ['POW!', 'BAM!', 'ZAP!', 'BOING!', 'KAPOW!', 'WHAM!', 'SPLAT!', 'PAF !', 'VLAN !', 'BOUM !', 'ZBAM!', 'WHOOSH!', 'SBLAM!', 'CRAC !'];
  const CARTOON = {
    splat(t) {   // a paint splat covers the old slide, then slides off the new one
      t.sfx('splat', 120);
      const D = 1500, x = rnd(480, 800), y = rnd(280, 440), S = 3000, N = 28, f = v => v.toFixed(1);   // min radius 76 u x 12.5 px covers every corner
      const pts = Array.from({ length: N }, (_, i) => {
        const a = i * 2 * Math.PI / N, r = i % 2 ? rnd(76, 82) : rnd(88, 104);
        return [r * Math.cos(a), r * Math.sin(a)];
      });
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      let path = 'M' + mid(pts[N - 1], pts[0]).map(f).join(' ');
      pts.forEach((p, i) => { const m = mid(p, pts[(i + 1) % N]); path += `Q${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`; });
      const drops = Array.from({ length: 7 }, () => {
        const a = rnd(0, 2 * Math.PI), r = rnd(106, 112);
        return `<circle cx="${f(r * Math.cos(a))}" cy="${f(r * Math.sin(a))}" r="${f(rnd(4, 8))}"/>`;
      }).join('');
      const el = t.add(make('div', { className: 'fx-splat', innerHTML: `<svg viewBox="-120 -120 240 240"><path d="${path}Z"/>${drops}</svg>` }));
      el.style.cssText = `left:${x - S / 2}px;top:${y - S / 2}px;width:${S}px;height:${S}px`;
      el.style.setProperty('--g', `var(--fx-${pick([1, 3, 4, 5, 6])})`);
      const r = rnd(-20, 20), tf = (y, s) => `translateY(${y}px) scale(${s}) rotate(${r}deg)`;
      t.anim(el, [{ transform: tf(0, 0), opacity: 1, easing: 'cubic-bezier(.2,1.4,.4,1)' }, { transform: tf(0, 1), opacity: 1, offset: 0.28 },
                  { transform: tf(0, 1), opacity: 1, offset: 0.55, easing: 'ease-in' }, { transform: tf(1100, 1), opacity: 0 }], { duration: D, easing: 'linear' });
      t.hideAt(t.out, 0.28, D);
      return { cheer: 'SPLAT!', at: 250 };
    },
    poof(t) {   // the old slide shivers and vanishes in a puff of smoke
      t.sfx('whoosh', 250, 350); t.sfx('pop', 300);
      const D = 1300;
      t.anim(t.out, Array.from({ length: 8 }, (_, i) => ({
        transform: i === 0 ? 'translate(0px,0px)' : `translate(${rnd(-10, 10).toFixed(0)}px, ${rnd(-6, 6).toFixed(0)}px)`,
        opacity: i < 6 ? 1 : 0, offset: i < 6 ? i / 5 * 0.45 : i === 6 ? 0.451 : 1 })), { duration: D, easing: 'linear' });
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
        puff(t, (c + 0.5) * 256 + rnd(-40, 40), (r + 0.5) * 240 + rnd(-40, 40), rnd(380, 460), 250 + rnd(0, 120), 1000);
      }
      puff(t, W / 2, H / 2, 520, 300, 1000);
      confetti(t, W / 2, H / 2, 10, 500, 'fx-star', '✦');
      return { cheer: 'POOF!', at: 350 };
    },
    spring(t) {   // the new slide shoots up from below on a spring
      t.sfx('boing', 0);
      const K = 18;
      t.anim(t.inn, Array.from({ length: K + 1 }, (_, i) => {
        const s = i / K, y = i === K ? 0 : H * Math.exp(-4.5 * s) * Math.cos(2.5 * 2 * Math.PI * s);
        return { transform: `translateY(${y.toFixed(1)}px) scaleY(${i === K ? 1 : (1 + 0.06 * Math.sin(5 * Math.PI * s)).toFixed(3)})`, transformOrigin: '50% 100%' };
      }), { duration: 1300, easing: 'linear' });
      return Math.random() < 0.6 ? { cheer: 'BOING!', at: 200 } : undefined;
    },
    tear(t) {   // the old slide is torn in two and the halves fall away
      t.sfx('tear', 0);
      const pts = Array.from({ length: 15 }, (_, i) => `${(W / 2 + rnd(-35, 35)).toFixed(0)}px ${(i * H / 14).toFixed(0)}px`).join(', ');
      const [l, r] = t.pieces([
        { clip: `polygon(0px 0px, ${pts}, 0px ${H}px)`, box: { x: 0, y: 0, w: W / 2 + 40, h: H }, origin: `${W / 4}px ${H / 2}px` },
        { clip: `polygon(${W}px 0px, ${pts}, ${W}px ${H}px)`, box: { x: W / 2 - 40, y: 0, w: W / 2 + 40, h: H }, origin: `${W / 4 + 40}px ${H / 2}px` }]);
      [[l, -1], [r, 1]].forEach(([el, s]) => t.anim(el, [
        { transform: 'translate(0px,0px) rotate(0deg)' }, { transform: `translate(${s * 30}px,0px) rotate(${s * 2}deg)`, offset: 0.25, easing: FALL },
        { transform: `translate(${s * rnd(300, 480)}px, ${H + 100}px) rotate(${s * rnd(25, 45)}deg)` }], { duration: 1200, easing: 'linear' }));
      return { cheer: pick(['RRRIP!', 'SCRITCH!']), at: 100 };
    },
    weight(t) {   // a ten-ton weight flattens the old slide; the new one springs up
      t.sfx('whistleDown', 0, 500); t.sfx('thud', 510); t.sfx('boing', 940);
      const D = 1700, h = 260, floor = H - 20, sq = 20 / H;
      const wt = t.add(make('div', { className: 'fx-weight' }, make('span', { textContent: pick(['10 t', '16 t', '42 t']) })));
      const x = rnd(260, W - 620);
      wt.style.left = x + 'px';
      const ty = y => ({ transform: `translateY(${y}px)` });
      t.anim(wt, [{ ...ty(-h - 60), offset: 0 }, { ...ty(-h), offset: 0.05, easing: FALL }, { ...ty(floor - h), offset: 0.3, easing: 'ease-out' },
                  { ...ty(floor - h - 30), offset: 0.36, easing: 'ease-in' }, { ...ty(floor - h), offset: 0.42 }, { ...ty(floor - h), offset: 0.5, easing: 'ease-in' },
                  { ...ty(-h - 80), offset: 0.68 }, { ...ty(-h - 80), offset: 1 }], { duration: D, easing: 'linear' });
      const sy = (s, o, offset, easing) => ({ transform: `scaleY(${s})`, transformOrigin: '50% 100%', opacity: o, offset, easing });
      t.anim(t.out, [sy(1, 1, 0), sy(1, 1, 0.05, FALL), sy(sq, 1, 0.3), sy(sq, 1, 0.5), sy(sq, 0, 0.501), sy(sq, 0, 1)], { duration: D, easing: 'linear' });
      t.anim(t.inn, [sy(0, 1, 0), sy(0, 1, 0.55), sy(1.18, 1, 0.72), sy(0.92, 1, 0.84), sy(1.04, 1, 0.93), sy(1, 1, 1)], { duration: D, easing: 'ease-out' });
      for (let i = 0; i < 5; i++) puff(t, x + 180 + rnd(-260, 260), floor - rnd(0, 40), rnd(110, 170), 0.3 * D, 600);
      return { cheer: pick(['BONK!', 'CLONK!', 'SPLOTCH!']), at: 0.3 * D };
    },
    stretch(t) {   // the old slide is pulled back like a slingshot and let go
      t.sfx('whistleUp', 0, 400); t.sfx('whoosh', 400, 400);
      const d = t.dir;
      t.anim(t.out, [{ transform: 'translateX(0px) scaleX(1) skewX(0deg)', easing: 'ease-out' },
                     { transform: `translateX(${d * 160}px) scaleX(1.3) skewX(${d * 10}deg)`, offset: 0.45, easing: 'cubic-bezier(.6,0,1,.4)' },
                     { transform: `translateX(${-d * 2200}px) scaleX(.6) skewX(${-d * 25}deg)` }], { duration: 900, easing: 'linear' });
      t.anim(t.inn, [{ transform: `translateX(${d * W}px) scaleX(1.6)` }, { transform: `translateX(${-d * 60}px) scaleX(.85)`, offset: 0.6 },
                     { transform: `translateX(${d * 20}px) scaleX(1.05)`, offset: 0.82 }, { transform: 'translateX(0px) scaleX(1)' }],
             { duration: 800, delay: 550, easing: 'ease-out' });
      return Math.random() < 0.6 ? { cheer: 'WHOOSH!', at: 450 } : undefined;
    },
    pageTurn(t) {   // the old slide turns over like the page of a book
      t.sfx('whoosh', 0, 700);
      const d = t.dir, o = d > 0 ? '0% 50%' : '100% 50%', D = 1000;
      t.top(t.out);
      t.anim(t.out, [{ transform: 'perspective(2200px) rotateY(0deg)', transformOrigin: o, opacity: 1, filter: 'brightness(1)' },
                     { transform: `perspective(2200px) rotateY(${-d * 90}deg)`, transformOrigin: o, opacity: 1, filter: 'brightness(.55)', offset: 0.5 },
                     { transform: `perspective(2200px) rotateY(${-d * 90}deg)`, transformOrigin: o, opacity: 0, filter: 'brightness(.55)', offset: 0.501 },
                     { transform: `perspective(2200px) rotateY(${-d * 180}deg)`, transformOrigin: o, opacity: 0, filter: 'brightness(.55)' }], { duration: D, easing: 'ease-in-out' });
      t.anim(t.inn, [{ filter: 'brightness(.6)' }, { filter: 'brightness(1)' }], { duration: D * 0.6, easing: 'ease-out' });
    },
  };

  /* the memes set: formats everyone knows, redrawn from CSS and SVG -- no picture of anybody.
     The captions and the doge's words come from the deck itself where they can. */
  const MEME_CAPTIONS = [
    ['ONE DOES NOT SIMPLY', 'SKIP TO SLIDE {n}'], ['WHAT IF I TOLD YOU', 'THERE IS ANOTHER SLIDE'],
    ['BRACE YOURSELVES', 'MORE SLIDES ARE COMING'], ['Y U NO', 'STAY ON SLIDE {m}'], ['SHUT UP AND', 'TAKE MY SLIDE'],
    ['I HAVE NO IDEA', 'WHAT SLIDE {n} IS ABOUT'], ['SLIDES', 'SLIDES EVERYWHERE'], ['NOT SURE IF NEXT SLIDE', 'OR SAME SLIDE WITH MORE TEXT'],
    ['SLIDE {m}?', 'NAILED IT'], ['AND THEN I SAID', 'NEXT SLIDE PLEASE'], ['CHALLENGE ACCEPTED', 'SLIDE {n}'],
  ];
  const GLASSES = ['XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', '.XwwXXXXXXXXX....XwwXXXXXXXXX.',
                   '.XXwwXXXXXXXX....XXwwXXXXXXXX.', '..XXXXXXXXXX......XXXXXXXXXX..', '...XXXXXXXX........XXXXXXXX...'];
  const glassesSvg = () => '<svg viewBox="0 0 30 6" shape-rendering="crispEdges">' + GLASSES.map((row, y) => [...row].map((ch, x) =>
    ch === '.' ? '' : `<rect class="${ch === 'X' ? 'k' : 'w'}" x="${x}" y="${y}" width="1.02" height="1.02"/>`).join('')).join('') + '</svg>';
  function popIn(t, el, a, D, base) {   // scale 0 -> overshoot -> 1 at the fraction a of a D ms timeline
    const tf = s => (base || '') + ` scale(${s})`;
    t.anim(el, [{ transform: tf(0) }, { transform: tf(0), offset: a }, { transform: tf(1.25), offset: a + 0.05 }, { transform: tf(1), offset: a + 0.1 }, { transform: tf(1) }],
           { duration: D, easing: 'ease-out' });
  }
  const MEMES = {
    caption(t) {   // top text, bottom text, in the font
      const D = 1700, fill = s => s.replace('{n}', label[t.to]).replace('{m}', label[t.from]);
      const [a, b] = pick(MEME_CAPTIONS).map(fill);
      const top = t.add(make('div', { className: 'fx-impact top', textContent: a })), bot = t.add(make('div', { className: 'fx-impact bottom', textContent: b }));
      t.during(top, 0.02, 0.8, D);
      t.during(bot, 0.3, 0.8, D);
      t.anim(t.out, [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }], { duration: D * 0.8, easing: 'linear' });
      t.hideAt(t.out, 0.8, D);
      t.sfx('boom', 0.3 * D);
    },
    doge(t) {   // wow. such slide. the words are the titles' own
      const D = 1800;
      const words = [titleOf(t.from), titleOf(t.to)].join(' ').split(/[^\p{L}\p{N}-]+/u).filter(w => w.length > 3).map(w => w.toLowerCase());
      const pool = shuffle(words.length >= 5 ? words : words.concat(['slide', 'science', 'graph', 'research', 'transition']));
      const lines = shuffle(['wow'].concat(['such', 'very', 'much', 'so', 'many', 'amaze'].map((q, i) => q === 'amaze' ? 'amaze' : q + ' ' + pool[i % pool.length])));
      const spots = shuffle([[110, 80], [720, 100], [300, 260], [820, 300], [120, 460], [640, 470], [360, 600]]);
      lines.forEach((txt, i) => {
        const el = t.add(make('div', { className: 'fx-doge fx-t' + (i % 6), textContent: txt })), a = 0.05 + i * 0.09, [x, y] = spots[i];
        el.style.left = (x + rnd(-30, 30)) + 'px';
        el.style.top = (y + rnd(-20, 20)) + 'px';
        t.during(el, a, 0.78, D);
        popIn(t, el, a, D, `rotate(${rnd(-12, 12).toFixed(0)}deg)`);
        t.sfx('pop', a * D);
      });
      t.anim(t.out, [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }], { duration: D * 0.78, easing: 'linear' });
      t.hideAt(t.out, 0.78, D);
    },
    dramatic(t) {   // three sudden zooms on one spot of the old slide: dun, dun, DUUUN
      const D = 1500, o = `${rnd(35, 65).toFixed(0)}% ${rnd(30, 60).toFixed(0)}%`;
      const z = (s, offset) => ({ transform: `scale(${s})`, transformOrigin: o, filter: `saturate(${1 + (s - 1) * 0.8}) contrast(${1 + (s - 1) * 0.3})`, offset, easing: 'steps(1, end)' });
      t.anim(t.out, [z(1, 0), z(1.35, 0.15), z(1.9, 0.35), z(2.7, 0.55), z(2.7, 1)], { duration: D, easing: 'linear' });
      t.hideAt(t.out, 0.82, D);
      t.during(t.add(make('div', { className: 'fx-vignette' })), 0.15, 0.82, D);
      t.sfx('dun', 0.15 * D);
    },
    toBeContinued(t) {   // freeze frame, yellowed, and the arrow slides in
      const D = 1900, f = s => `sepia(${0.7 * s}) saturate(${1 + 0.8 * s}) hue-rotate(${-18 * s}deg) contrast(${1 + 0.15 * s})`;
      t.anim(t.out, [{ filter: f(0), transform: 'scale(1)' }, { filter: f(1), transform: 'scale(1.03)', offset: 0.12 }, { filter: f(1), transform: 'scale(1.03)' }],
             { duration: D, easing: 'ease-out' });
      t.hideAt(t.out, 0.86, D);
      const box = t.add(make('div', { className: 'fx-tbc', textContent: 'To Be Continued' }));
      t.anim(box, [{ transform: 'translateX(-760px)' }, { transform: 'translateX(-760px)', offset: 0.14, easing: 'cubic-bezier(.2,.8,.3,1)' },
                   { transform: 'translateX(0px)', offset: 0.32 }, { transform: 'translateX(0px)' }], { duration: D, easing: 'linear' });
      t.during(box, 0, 0.86, D);
      t.sfx('riff', 0.1 * D);
    },
    wasted(t) {   // forward, usually MISSION PASSED; otherwise WASTED, in slow grey
      const D = 1900, passed = t.dir > 0 && Math.random() < 0.6;
      const f = s => passed ? `grayscale(0) brightness(${1 + 0.08 * s}) saturate(${1 + 0.3 * s})` : `grayscale(${s}) brightness(${1 - 0.2 * s}) saturate(1)`;
      t.anim(t.out, [{ filter: f(0), transform: 'scale(1)' }, { filter: f(1), transform: 'scale(1.1)', offset: 0.45 }, { filter: f(1), transform: 'scale(1.12)' }],
             { duration: D, easing: 'ease-out' });
      t.hideAt(t.out, 0.88, D);
      const band = t.add(make('div', { className: 'fx-wasted' + (passed ? ' passed' : '') },
        make('b', { textContent: passed ? 'MISSION PASSED!' : 'WASTED' }), ...(passed ? [make('span', { textContent: 'RESPECT +' })] : [])));
      t.anim(band, [{ opacity: 0 }, { opacity: 0, offset: 0.38 }, { opacity: 1, offset: 0.5 }, { opacity: 1, offset: 0.88 }, { opacity: 0, offset: 0.881 }, { opacity: 0 }],
             { duration: D, easing: 'linear' });
      t.sfx(passed ? 'fanfare' : 'boom', 0.4 * D);
    },
    stonks(t) {   // the line goes up (going back: NOT STONKS, and it goes down)
      const D = 1900, up = t.dir > 0, k = 11;
      const pts = Array.from({ length: k }, (_, i) => {
        const s = i / (k - 1), y = 600 - 440 * s + (i === 0 || i === k - 1 ? 0 : i % 2 ? rnd(30, 110) : -rnd(10, 50));
        return [90 + 1060 * s, up ? y : H - y];
      });
      const [xe, ye] = pts[k - 1], [xp, yp] = pts[k - 2], ang = Math.atan2(ye - yp, xe - xp) * 180 / Math.PI;
      const grid = Array.from({ length: 9 }, (_, i) => `<line x1="${(i + 1) * 128}" y1="0" x2="${(i + 1) * 128}" y2="${H}"/>`).join('')
                 + Array.from({ length: 5 }, (_, i) => `<line x1="0" y1="${(i + 1) * 120}" x2="${W}" y2="${(i + 1) * 120}"/>`).join('');
      const panel = t.add(make('div', { className: 'fx-stonks' + (up ? '' : ' down'), innerHTML:
        `<svg viewBox="0 0 ${W} ${H}"><g class="grid">${grid}</g><polyline class="line" pathLength="1" points="${pts.map(p => p.map(v => v.toFixed(0)).join(',')).join(' ')}"/>`
        + `<polygon class="head" points="-10,-30 44,0 -10,30" transform="translate(${xe.toFixed(0)},${ye.toFixed(0)}) rotate(${ang.toFixed(1)})"/></svg>` }));
      const word = panel.appendChild(make('b', { textContent: up ? 'STONKS' : 'NOT STONKS' }));
      t.anim(panel, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.86 }, { opacity: 0 }], { duration: D, easing: 'linear' });
      t.anim(panel.querySelector('.line'), [{ strokeDashoffset: 1 }, { strokeDashoffset: 1, offset: 0.1 }, { strokeDashoffset: 0, offset: 0.6 }, { strokeDashoffset: 0 }],
             { duration: D, easing: 'linear' });
      t.during(panel.querySelector('.head'), 0.6, 1, D);
      popIn(t, word, 0.6, D);
      t.hideAt(t.out, 0.1, D);
      t.sfx('blips', 0.1 * D);
      t.sfx(up ? 'coin' : 'sad', 0.6 * D);
    },
    dealWithIt(t) {   // the pixel sunglasses come down, slowly, onto the slide's title
      const D = 2000, h1 = t.out.querySelector('h1'), sb = t.out.getBoundingClientRect(), k = sb.width / W || 1;
      let cx = W / 2, cy = 260;
      if (h1) {
        const rg = document.createRange();
        rg.selectNodeContents(h1);
        const r = rg.getBoundingClientRect();
        if (r.width) { cx = (r.left - sb.left + r.width / 2) / k; cy = (r.top - sb.top + r.height / 2) / k; }
      }
      cx = Math.max(290, Math.min(W - 290, cx));
      cy = Math.max(70, Math.min(H - 220, cy));
      const g = t.add(make('div', { className: 'fx-glasses', innerHTML: glassesSvg() }));
      g.style.left = (cx - 270) + 'px';
      g.style.top = (cy - 40) + 'px';
      t.anim(g, [{ transform: `translateY(${-(cy + 160)}px)` }, { transform: `translateY(${-(cy + 160)}px)`, offset: 0.08 },
                 { transform: 'translateY(0px)', offset: 0.42 }, { transform: 'translateY(0px)' }], { duration: D, easing: 'linear' });
      t.during(g, 0, 0.86, D);
      const cap = t.add(make('div', { className: 'fx-impact bottom', textContent: 'DEAL WITH IT' }));
      t.during(cap, 0.46, 0.86, D);
      popIn(t, cap, 0.46, D);
      t.hideAt(t.out, 0.86, D);
      t.sfx('thud', 0.42 * D);
      t.sfx('airhorn', 0.46 * D);
    },
    thisIsFine(t) {   // flames rise round the old slide; everything is fine; then they take it
      const D = 2100, n = 18;
      for (let i = 0; i < n; i++) {
        const el = t.add(make('div', { className: 'fx-flame' })), w = rnd(150, 230), h = rnd(260, 460);
        el.style.cssText = `left:${((i + 0.5) * W / n - w / 2 + rnd(-20, 20)).toFixed(0)}px;bottom:-40px;width:${w.toFixed(0)}px;height:${h.toFixed(0)}px`;
        t.anim(el, Array.from({ length: 12 }, (_, j) => {
          const s = j / 11, rise = s < 0.2 ? 1 - s / 0.2 : 0, big = s > 0.62 ? (s - 0.62) / 0.3 : 0;
          return { transform: `translateY(${(rise * 110).toFixed(0)}%) scale(${(1 + Math.min(1, big) * 2.6 + rnd(-0.08, 0.08)).toFixed(2)}, ${(1 + Math.min(1, big) * 1.9 + rnd(-0.15, 0.15)).toFixed(2)})`,
                   opacity: j === 11 ? 0 : 1 };
        }), { duration: D, delay: rnd(0, 120), easing: 'linear' });
      }
      t.anim(t.out, [{ filter: 'sepia(0) brightness(1)' }, { filter: 'sepia(.5) brightness(1.1)' }], { duration: D * 0.85, easing: 'linear' });
      t.hideAt(t.out, 0.85, D);
      const bubble = t.add(make('div', { className: 'fx-bubble', textContent: T.fine }));
      t.during(bubble, 0.22, 0.7, D);
      popIn(t, bubble, 0.22, D);
      t.sfx('crackle', 0, 1900);
      t.sfx('pop', 0.22 * D);
    },
    illuminati(t) {   // the eye in the triangle spins in from the dark
      const D = 1900, panel = t.add(make('div', { className: 'fx-illu', innerHTML:
        '<svg viewBox="-160 -150 320 290"><polygon points="0,-140 150,120 -150,120"/><path class="eye" d="M-70 40Q0 -20 70 40Q0 100 -70 40Z"/>'
        + '<circle class="iris" cx="0" cy="40" r="22"/><circle class="pupil" cx="0" cy="40" r="9"/></svg>' }));
      const word = panel.appendChild(make('b', { textContent: 'ILLUMINATI CONFIRMED' }));
      t.anim(panel, [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: D, easing: 'linear' });
      t.anim(panel.querySelector('svg'), [{ transform: 'scale(.2) rotate(0deg)' }, { transform: 'scale(1) rotate(720deg)', offset: 0.45 },
                                          { transform: 'scale(1.08) rotate(720deg)', offset: 0.85 }, { transform: 'scale(3) rotate(720deg)' }], { duration: D, easing: 'ease-in-out' });
      t.during(word, 0.45, 0.85, D);
      t.hideAt(t.out, 0.12, D);
      t.sfx('eerie', 0, 1700);
    },
    ejected(t) {   // the old slide is thrown out of the airlock; it was not the impostor
      const D = 2200, stars = Array.from({ length: 70 }, () =>
        `radial-gradient(circle at ${rnd(0, 100).toFixed(1)}% ${rnd(0, 100).toFixed(1)}%, var(--fx-pin) 0 ${rnd(0.6, 1.8).toFixed(1)}px, transparent ${rnd(2, 3).toFixed(1)}px)`);
      const space = t.under(make('div', { className: 'fx-space' }));
      space.style.background = stars.join(',') + ',var(--fx-night)';
      t.anim(space, [{ opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 1 }], { duration: D, easing: 'linear' });
      t.anim(t.inn, [{ opacity: 0 }, { opacity: 0, offset: 0.84 }, { opacity: 1 }], { duration: D, easing: 'linear' });
      t.anim(t.out, [{ transform: 'translate(0px, 0px) rotate(0deg) scale(1)' }, { transform: `translate(${-W * 0.8}px, 0px) rotate(0deg) scale(.22)`, offset: 0.12 },
                     { transform: `translate(${W * 0.8}px, ${rnd(-90, 90).toFixed(0)}px) rotate(${sign() * 720}deg) scale(.22)`, offset: 0.84 },
                     { transform: `translate(${W * 0.8}px, 0px) rotate(0deg) scale(.22)` }], { duration: D, easing: 'linear' });
      t.hideAt(t.out, 0.84, D);
      const said = T.ejected(label[t.from]);
      const line = t.add(make('div', { className: 'fx-eject' }, make('span', { textContent: said }), make('small', { textContent: T.impostor })));
      t.anim(line.firstChild, [{ clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 100% 0% 0%)', offset: 0.25 }, { clipPath: 'inset(0% 0% 0% 0%)', offset: 0.62 },
                               { clipPath: 'inset(0% 0% 0% 0%)' }], { duration: D, easing: `steps(${said.length}, end)` });
      t.during(line.lastChild, 0.66, 0.9, D);
      t.during(line, 0, 0.9, D);
      t.sfx('whoosh', 0, 500);
      t.sfx('hum', 300, 1600);
    },
    errors(t) {   // a trail of error dialogs, one per step, then all gone
      const D = 1700, n = 14, x0 = rnd(60, 280), y0 = rnd(40, 120), wave = rnd(20, 60);
      for (let i = 0; i < n; i++) {
        const box = t.add(make('div', { className: 'fx-err' },
          make('div', { className: 'bar' }, make('span', { textContent: T.errTitle }), make('i', { textContent: '✕' })),
          make('div', { className: 'msg' }, make('b'), make('span', { textContent: T.errMsg })),
          make('div', { className: 'btn', textContent: 'OK' })));
        box.style.left = (x0 + i * 38) + 'px';
        box.style.top = (y0 + i * 24 + wave * Math.sin(i / 2)).toFixed(0) + 'px';
        const a = 0.03 + i * 0.045;
        t.during(box, a, 0.85, D);
        t.sfx('ding', a * D);
      }
      t.hideAt(t.out, 0.85, D);
    },
    loading(t) {   // loading the next slide... 99 %... 99 %... 100 %
      const D = 2000;
      t.during(t.add(make('div', { className: 'fx-dim' })), 0.02, 0.86, D);
      const pct = make('div', { className: 'pct' });
      const box = t.add(make('div', { className: 'fx-load' }, make('div', { className: 'spin' }), make('span', { textContent: T.loading }),
                                  make('div', { className: 'track' }, make('i')), pct));
      [['0 %', 0, 0.08], ['37 %', 0.08, 0.18], ['74 %', 0.18, 0.28], ['99 %', 0.28, 0.8], ['100 %', 0.8, 0.86]].forEach(([s, a, b]) =>
        t.during(pct.appendChild(make('span', { textContent: s })), a, b, D));
      t.anim(box.querySelector('.track i'), [{ transform: 'scaleX(0)', easing: 'ease-out' }, { transform: 'scaleX(.99)', offset: 0.3 }, { transform: 'scaleX(.99)', offset: 0.8 },
                                             { transform: 'scaleX(1)', offset: 0.82 }, { transform: 'scaleX(1)' }], { duration: D, easing: 'linear' });
      t.anim(box.querySelector('.spin'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 700, iterations: Math.ceil(D / 700), easing: 'linear' });
      t.during(box, 0.02, 0.86, D);
      t.hideAt(t.out, 0.86, D);
      t.sfx('blips', 0);
      t.sfx('ding', 0.8 * D);
    },
  };

  /* going back in a fun mode: two times in five, the tape rewinds */
  const REWIND = {
    rewind(t) {
      const D = 750;
      t.sfx('rewind', 0);
      t.add(make('div', { className: 'fx-scan' }));
      const osd = t.add(make('div', { className: 'fx-osd', textContent: '\u25C0\u25C0 REW' }));
      t.anim(osd, Array.from({ length: 7 }, (_, i) => ({ opacity: i % 2 ? 0.25 : 1, easing: 'steps(1, end)' })), { duration: D });
      const jit = (i, n) => i === 0 || i === n ? 'translate(0px,0px) skewX(0deg)' : `translate(${rnd(-40, 40).toFixed(0)}px, ${rnd(-12, 12).toFixed(0)}px) skewX(${rnd(-9, 9).toFixed(1)}deg)`;
      t.anim(t.out, Array.from({ length: 7 }, (_, i) => ({ transform: jit(i, 6), filter: `saturate(${i === 6 ? 1 : rnd(0.2, 2).toFixed(1)})`, easing: 'steps(1, end)' })),
             { duration: D * 0.55, easing: 'linear' });
      t.hideAt(t.out, 0.55, D);
      t.anim(t.inn, [{ transform: `translateY(${-H}px)`, filter: 'saturate(.3)' }, { transform: `translateY(${-H}px)`, filter: 'saturate(.3)', offset: 0.55, easing: 'steps(5, end)' },
                     { transform: 'translateY(0px)', filter: 'saturate(1)' }], { duration: D, easing: 'linear' });
    },
  };

  /* the modes: pro is clipped to the frame; a fun set may add its own garnish */
  const SETS = {
    pro: { fx: PRO, clip: true },
    bowling: {
      fx: BOWLING,
      extras(t, e) {
        const cheer = e.cheer || (Math.random() < 0.5 && pick(CHEERS)), at = e.at === undefined ? rnd(150, 450) : e.at;
        if (cheer) { banner(t, cheer, at); t.sfx('fanfare', at); }
        if (e.cheer || Math.random() < 0.35) confetti(t, rnd(300, W - 300), rnd(300, 560), 70, at + 100);
      },
    },
    arcade: {
      fx: ARCADE,
      extras(t, e) {
        const cheer = e.cheer === undefined ? Math.random() < 0.5 && pick(ARCADE_CHEERS) : e.cheer, at = e.at === undefined ? rnd(150, 450) : e.at;
        if (cheer) { banner(t, cheer, at, { kind: 'arcade' }); t.sfx('coin', at); }
        if (Math.random() < 0.3) confetti(t, rnd(300, W - 300), rnd(300, 560), 40, at + 100, 'fx-bit fx-sq');
      },
    },
    cinema: { fx: CINEMA, extras(t) { if (Math.random() < 0.6) grain(t, 1500); } },
    memes: { fx: MEMES },
    back: { fx: REWIND },
    cartoon: {
      fx: CARTOON,
      extras(t, e) {
        const cheer = e.cheer || (Math.random() < 0.55 && pick(COMIC)), at = e.at === undefined ? rnd(150, 400) : e.at;
        if (cheer) { banner(t, cheer, at, { kind: 'comic' }); t.sfx('pop', at); }
        if (Math.random() < 0.3) confetti(t, rnd(300, W - 300), rnd(300, 500), 14, at, 'fx-star', '✦');
      },
    },
  };

  function playTransition(from, fromStep, to, toStep, dir) {
    const out = slides[from], inn = slides[to], anims = [], timers = [], queued = [];
    const layer = deck.appendChild(make('div', { className: 'fx-layer' }));
    let under = null;
    out.classList.add('fx-out');
    out.style.zIndex = 1;
    inn.style.zIndex = 2;
    const t = {
      out, inn, dir, from, to, fun: false,
      sfx(name, at, arg) {   // a sound at ms from now, if sound is on; scheduled once the pace is known, dropped if cut short
        if (fxSound && SOUNDS[name]) queued.push([name, at || 0, arg]);
      },
      // a copy seen through a box of its own size (a tile) or the whole slide (a clipped shape), in a
      // wrapper that carries the motion -- and, in the fun sets, a drop shadow. A tile-sized box keeps
      // each moving layer small: two dozen full-slide layers with a filter each made the GPU stall.
      piece(el, box) {
        const w = layer.appendChild(make('div', { className: 'fx-piece' + (t.fun ? ' shadow' : '') }));
        w.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px`;
        if (box.x || box.y) el.style.transform = `translate(${-box.x}px, ${-box.y}px)`;
        w.appendChild(el);
        return w;
      },
      anim(el, frames, o) {
        const a = el.animate(frames, Object.assign({ duration: 600, easing: 'ease-in-out', fill: 'both' }, o));
        anims.push(a);
        return a;
      },
      add: el => layer.appendChild(el),
      under(el) {   // below both slides
        if (!under) under = deck.insertBefore(make('div', { className: 'fx-layer fx-under' }), deck.firstChild);
        return under.appendChild(el);
      },
      top(el) { el.style.zIndex = 3; },
      clip() { deck.classList.add('fx-clip'); },
      // opacity switched at one instant (a fraction) of a D ms timeline
      hideAt: (el, at, D) => t.anim(el, [{ opacity: 1 }, { opacity: 1, offset: at }, { opacity: 0, offset: Math.min(1, at + 0.001) }, { opacity: 0 }], { duration: D, easing: 'linear' }),
      during: (el, a, b, D) => t.anim(el, [{ opacity: 0 }, { opacity: 0, offset: a }, { opacity: 1, offset: Math.min(b, a + 0.001) }, { opacity: 1, offset: b },
                                           { opacity: 0, offset: Math.min(1, b + 0.001) }, { opacity: 0 }], { duration: D, easing: 'linear' }),
      showAt: (el, at, D) => t.anim(el, [{ opacity: 0 }, { opacity: 0, offset: at }, { opacity: 1, offset: Math.min(1, at + 0.001) }, { opacity: 1 }], { duration: D, easing: 'linear' }),
      // a copy of the outgoing ('out') or incoming ('in') slide, in the layer above both
      clone: which => layer.appendChild(which === 'in' ? cloneSlide(to, toStep) : cloneSlide(from, fromStep)),
      // the slide as cols x rows clipped copies; each tile turns about its own centre. Cutting up
      // the outgoing slide hides it; the incoming one stays where it is, for the effect to hide
      tiles(cols, rows, which) {
        if (which !== 'in') out.classList.remove('fx-out');
        const list = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const x = Math.round(c * W / cols), y = Math.round(r * H / rows);
          const w = Math.round((c + 1) * W / cols) - x, h = Math.round((r + 1) * H / rows) - y;
          list.push({ el: t.piece(t.clone(which), { x, y, w, h }), x, y, w, h, c, r, cx: x + w / 2, cy: y + h / 2 });
        }
        return list;
      },
      // the outgoing slide as copies clipped to the given shapes ({clip, origin}); it hides itself
      // (clip in slide coordinates; box, the part of the slide it can occupy; origin, in that box)
      pieces(parts) {
        out.classList.remove('fx-out');
        return parts.map(p => {
          const copy = t.clone('out');
          if (p.clip) copy.style.clipPath = p.clip;
          const w = t.piece(copy, p.box || { x: 0, y: 0, w: W, h: H });
          w.style.transformOrigin = p.origin || '50% 50%';
          return w;
        });
      },
    };
    let key = fxForce;
    fxForce = null;
    if (!key && dir < 0 && (FX_FUN.includes(fxMode) || fxMode === 'chaos') && Math.random() < 0.4) key = 'back:rewind';
    if (!key) {   // chaos draws a category first, so bowling's two dozen do not crowd out the rest
      const cat = fxMode === 'chaos' ? draw('chaos', FX_FUN) : fxMode === 'games' ? 'pro' : fxMode;
      key = draw(cat, Object.keys(SETS[cat].fx).map(n => cat + ':' + n));
    }
    const [setName, name] = key.split(':');
    fxLast = key;
    showFxName(key, dir > 0 ? to : from);
    const set = SETS[setName];
    t.fun = setName !== 'pro';
    if (set.clip) t.clip();
    const extra = set.fx[name](t) || {};
    if (set.extras) set.extras(t, extra);
    // pace: fit within FX_CAP, and double speed on a jump or two slide changes in quick succession
    const end = Math.max(0, ...anims.map(a => a.effect.getComputedTiming().endTime)), now = performance.now();
    const rate = Math.max(1, end / FX_CAP) * (now - fxLastAt < 900 || Math.abs(to - from) > 1 ? 2 : 1);
    fxLastAt = now;
    if (rate !== 1) anims.forEach(a => { a.playbackRate = rate; });
    queued.forEach(([name, at, arg]) => timers.push(setTimeout(() => SOUNDS[name](typeof arg === 'number' ? arg / rate : arg), at / rate)));
    let done = false;
    const run = {
      name: fxLast,
      finish() {
        if (done) return;
        done = true;
        anims.forEach(a => a.cancel());
        timers.forEach(clearTimeout);
        layer.remove();
        if (under) under.remove();
        deck.classList.remove('fx-clip');
        out.classList.remove('fx-out');
        out.style.zIndex = inn.style.zIndex = '';
        if (fxRun === run) fxRun = null;
      },
    };
    Promise.all(anims.map(a => a.finished)).then(run.finish, () => { /* cut short */ });
    return run;
  }
  function setFx(m, remote) {
    if (fxRun) fxRun.finish();
    stopGame();
    fxMode = m;
    try { localStorage.setItem(FX_KEY, m); } catch (_) { /* no storage */ }
    toast(T.fx[m] + '  (' + (FX_MODES.indexOf(m) + 1) + '/' + FX_MODES.length + ')');
    if (!remote) send({ deck: 'fx', m });
  }
  function setSound(on, remote) {
    fxSound = on;
    try { if (on) localStorage.setItem(SFX_KEY, '1'); else localStorage.removeItem(SFX_KEY); } catch (_) { /* no storage */ }
    if (on && !PRESENTER) ac();   // a key press may start audio: do it now
    toast(T.sound[on ? 1 : 0]);
    if (!remote) send({ deck: 'sfx', on });
  }
  let toastEl = null, toastTimer = 0;
  function toast(text) {
    if (!toastEl) toastEl = document.body.appendChild(make('div', { id: 'toast' }));
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 1800);
  }
  addEventListener('beforeprint', () => { if (fxRun) fxRun.finish(); });

  /* ---- games mode: win a little game made of the slides to reach the next one -------
     Only going forward from the audience window: a build, going back, a jump and the
     speaker view all move on without a game. Every game plays from the keyboard
     (a clicker's PageUp/PageDown count as arrows) and most with the mouse; Escape
     skips it. The games draw inside #deck, so they scale with it. Deck.play() lists
     them; Deck.play('taquin') starts that one towards the next slide. */
  let game = null;
  const isKey = (e, ...keys) => keys.includes(e.key);
  const FWD = ['ArrowRight', 'ArrowDown', 'PageDown'], BWD = ['ArrowLeft', 'ArrowUp', 'PageUp'], GO = [' ', 'Enter'];
  const GAMES = {
    stack: {   // rebuild the next slide from the bottom up: stop each band right over the one below (after Ketchapp's Stack)
      seamless: true,
      play(g) {
        const n = 6, h = H / n, PERFECT = 18, MINW = 360;
        let L = 0, R = W, level = n - 2, x = 0, lo = 0, hi = 0, d = 0, dir = 1, v = 0, moving = null, streak = 0, misses = 0;
        g.add(make('div', { className: 'g-well' }));
        g.add(g.view(g.to, 0, 0, 0, W, H)).classList.add('g-ghost');
        const band = (x, w, i) => g.view(g.to, 0, x, i * h, w, h);   // the part [x, x + w] of band i of the next slide
        const put = (el, x, y) => { el.style.transform = `translate(${x}px, ${y}px)`; return el; };
        put(g.add(band(0, W, n - 1)), 0, (n - 1) * h);
        const fall = (el, x, y, s) => el.animate([{ transform: `translate(${x}px, ${y}px) rotate(0deg)`, opacity: 1 },
                                                  { transform: `translate(${x + s * rnd(40, 140)}px, ${H + 40}px) rotate(${s * rnd(20, 70)}deg)`, opacity: 0.8 }],
                                                 { duration: 750, easing: 'cubic-bezier(.5,0,1,.6)', fill: 'forwards' });
        const spawn = () => {
          // it sweeps the screen, from alternate sides, up to half out of either edge -- so its place is always on the way
          lo = -0.5 * (R - L);
          hi = W - 0.5 * (R - L);
          dir = (level + misses) % 2 ? 1 : -1;   // after a miss it comes back from the other side
          x = dir > 0 ? lo : hi;
          d = x - L;
          v = (560 + 110 * (n - 2 - level)) * Math.max(0.5, Math.pow(0.85, misses));   // each miss in a row slows it down
          moving = put(g.add(band(L, R - L, level)), x, level * h);
          moving.classList.add('g-band');
          g.status(`${n - 2 - level} / ${n - 1}`);
        };
        const finale = () => {   // the cut-away edges fill back in: the next slide, whole
          g.status(`${n - 1} / ${n - 1}`);
          g.add(g.view(g.to, 0, 0, 0, W, H)).animate([{ opacity: 0, filter: 'brightness(1.6)' }, { opacity: 1, filter: 'brightness(1)' }],
                                                      { duration: 500, easing: 'ease-out', fill: 'both' });
          g.win();
        };
        const place = () => {
          if (!moving || g.over) return;
          moving.remove();
          moving = null;
          const y = level * h, perfect = Math.abs(d) <= PERFECT;
          if (perfect) d = 0;
          const nl = Math.max(L, L + d), nr = Math.min(R, R + d);
          if (nr - nl < 1) {   // missed it entirely: it falls, and comes round again
            fall(g.add(band(L, R - L, level)), L + d, y, Math.sign(d));
            g.say(T.games.miss, 'small');
            g.sfx('thud');
            g.shake(10);
            streak = 0;
            misses++;
            g.after(450, spawn);
            return;
          }
          if (d > 0) fall(g.add(band(R - d, d, level)), R, y, 1);   // the overhang drops away
          if (d < 0) fall(g.add(band(L, -d, level)), L + d, y, -1);
          streak = perfect ? streak + 1 : 0;
          misses = 0;
          let kl = nl, kr = nr;
          if (streak >= 3) { kl = Math.max(0, nl - 40); kr = Math.min(W, nr + 40); }   // a run of perfect ones wins width back
          if (kr - kl < MINW) {   // never down to a sliver nobody can land on: keep MINW round the overlap
            const c = Math.max(MINW / 2, Math.min(W - MINW / 2, (kl + kr) / 2));
            kl = c - MINW / 2;
            kr = c + MINW / 2;
          }
          const kept = put(g.add(band(kl, kr - kl, level)), kl, y);
          kept.animate([{ transform: `translate(${kl}px, ${y - 12}px) scaleY(1.08)`, filter: 'brightness(1.5)' },
                        { transform: `translate(${kl}px, ${y}px) scaleY(1)`, filter: 'brightness(1)' }], { duration: 180, easing: 'cubic-bezier(.3,1.6,.5,1)' });
          g.dust(kl + (kr - kl) / 2, y + h, perfect ? 12 : 6);
          if (perfect) {
            g.say(streak > 1 ? T.games.perfect + ' ×' + streak : T.games.perfect, 'small');
            g.note(523 * Math.pow(2, Math.min(streak - 1, 8) / 6), 220);   // a whole tone higher each time
          } else { g.sfx('clack'); g.shake(4); }
          L = kl;
          R = kr;
          level--;
          if (level >= 0) g.after(perfect ? 160 : 240, spawn); else g.after(200, finale);
        };
        g.loop(dt => {
          if (!moving) return;
          x += dir * v * dt;
          if (x > hi) { x = hi; dir = -1; } else if (x < lo) { x = lo; dir = 1; }
          d = x - L;
          moving.style.transform = `translate(${x}px, ${level * h}px)`;
        });
        g.listen(g.root, 'pointerdown', place);
        g.key = e => { if (!e.repeat && isKey(e, ...GO, ...FWD)) place(); };
        spawn();
      },
    },
    safe: {   // the old slide is a safe door: stop three tumblers under the mark and it swings open on the next one
      seamless: true,
      play(g) {
        const LV = [{ v: 150, w: 15 }, { v: 205, w: 11 }, { v: 265, w: 8 }];   // degrees per second, half-width of the zone
        g.add(g.view(g.to, 0, 0, 0, W, H));
        const glow = g.add(make('div', { className: 'g-glow' }));
        const door = g.add(g.view(g.from, g.fromStep, 0, 0, W, H));
        door.classList.add('g-door');
        let marks = '';
        for (let k = 0; k < 100; k++) {
          const major = k % 10 === 0;
          marks += `<line x1="0" y1="${major ? -156 : -166}" x2="0" y2="-178" transform="rotate(${k * 3.6})"${major ? ' class="major"' : ''}/>`;
          if (major) marks += `<text x="0" y="-136" transform="rotate(${k * 3.6})">${k}</text>`;
        }
        const lock = door.appendChild(make('div', { className: 'g-lock' }));
        lock.innerHTML = '<div class="lamps"><i></i><i></i><i></i></div><svg viewBox="-200 -200 400 400"><circle class="bezel" r="198"/>'
          + `<g class="disk"><circle class="face" r="184"/><path class="target"/>${marks}<circle class="hub" r="54"/><circle class="knurl" r="42"/></g>`
          + '<path class="index" d="M-13 -200L13 -200L0 -176Z"/></svg>';
        const disk = lock.querySelector('.disk'), zone = lock.querySelector('.target'), index = lock.querySelector('.index');
        const lamps = lock.querySelectorAll('.lamps i');
        const wrap = a => ((a + 180) % 360 + 360) % 360 - 180;
        const pt = (r, a) => `${(r * Math.sin(a * Math.PI / 180)).toFixed(1)} ${(-r * Math.cos(a * Math.PI / 180)).toFixed(1)}`;
        const arc = (c, w) => `M${pt(184, c - w)}A184 184 0 0 1 ${pt(184, c + w)}L${pt(122, c + w)}A122 122 0 0 0 ${pt(122, c - w)}Z`;
        let th = 0, lvl = 0, dir = 1, phi = 0, open = false, lastTick = 0, holdUntil = 0;
        const aim = () => {   // a new zone, a good way round before it reaches the mark
          phi = -dir * rnd(110, 220) - th;
          zone.setAttribute('d', arc(phi, LV[lvl].w));
          g.status(`${lvl} / 3`);
        };
        aim();
        g.loop(dt => {
          if (performance.now() < holdUntil) return;   // hit-stop: the dial catches for a moment
          th += dir * (open ? 900 : LV[lvl].v) * dt;
          disk.setAttribute('transform', `rotate(${th.toFixed(2)})`);
          index.classList.toggle('hot', !open && Math.abs(wrap(th + phi)) <= LV[lvl].w);
          const t = Math.floor(th / 36);
          if (t !== lastTick) { lastTick = t; g.tick(); }   // a soft click every ten numbers
        });
        const unlock = () => {
          open = true;
          g.status('3 / 3');
          g.after(450, () => {
            g.sfx('whoosh', 900);
            door.animate([{ transform: 'perspective(1800px) rotateY(0deg)' }, { transform: 'perspective(1800px) rotateY(-112deg)' }],
                         { duration: 1100, easing: 'cubic-bezier(.6,0,.25,1)', fill: 'forwards' });
            glow.animate([{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], { duration: 1300, fill: 'forwards' });
          });
          g.after(1300, () => g.win());
        };
        const press = () => {
          if (open || g.over || performance.now() < holdUntil) return;   // a double tap on a hit is not a miss
          if (Math.abs(wrap(th + phi)) <= LV[lvl].w + 1.5) {
            lamps[lvl].classList.add('on');
            index.classList.remove('hot');
            g.sfx('clack');
            g.note(392 * Math.pow(2, lvl / 3), 240);
            holdUntil = performance.now() + 110;
            lock.animate([{ transform: 'translate(-50%,-50%) scale(1.04)' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 180, easing: 'ease-out' });
            g.shake(3);
            lvl++;
            if (lvl === 3) { lvl = 2; unlock(); return; }
            dir = -dir;
            aim();
          } else {   // a miss: a buzz, and the zone jumps elsewhere -- mashing does not pay
            g.sfx('zap');
            g.say(T.games.miss, 'small');
            lock.animate([0, -12, 10, -7, 4, 0].map(x => ({ transform: `translate(calc(-50% + ${x}px), -50%)` })), { duration: 320 });
            aim();
          }
        };
        g.listen(g.root, 'pointerdown', press);
        g.key = e => { if (!e.repeat && isKey(e, ...GO, ...FWD)) press(); };
      },
    },
    bridge: {   // hold to grow a bridge, let go to drop it across the gap, walk over to the next slide
      seamless: true,
      play(g) {
        const TOP = 500, P1 = 200, gap = rnd(250, 600), w2 = rnd(100, 190), x2 = P1 + gap, mid = x2 + w2 / 2, S = 0.2, SW = W * S, SH = H * S;
        const cam = g.add(make('div', { className: 'g-cam' }));
        const put = (el, css) => { if (css) el.style.cssText = css; return cam.appendChild(el); };
        put(make('div', { className: 'g-sky' }));
        const sign = (k, st, cx) => {   // a slide on a post: where you are, and where you are going
          put(make('div', { className: 'g-post' }), `left:${cx - 4}px;top:${TOP - 64}px;height:64px`);
          const v = g.view(k, st, 0, 0, W, H), x = cx - SW / 2, y = TOP - 64 - SH;
          v.classList.add('g-board');
          v.style.transform = `translate(${x}px, ${y}px) scale(${S})`;
          put(v);
          return [x, y];
        };
        sign(g.from, g.fromStep, Math.max(SW / 2 + 12, P1 / 2));
        const [sx, sy] = sign(g.to, 0, Math.min(W - SW / 2 - 12, mid));
        put(make('div', { className: 'g-pillar' }), `left:0px;top:${TOP}px;width:${P1}px;height:${H - TOP}px`);
        put(make('div', { className: 'g-pillar' }), `left:${x2.toFixed(0)}px;top:${TOP}px;width:${w2.toFixed(0)}px;height:${H - TOP}px`);
        put(make('div', { className: 'g-mark' }), `left:${(mid - 10).toFixed(0)}px;top:${TOP}px`);
        const stick = put(make('div', { className: 'g-stick' })), hero = put(make('div', { className: 'g-hero' }));
        let state = 'ready', len = 0, hx = P1 - 30, target = 0, ok = false, clock = 0, lastTick = 0;
        const drawStick = ang => { stick.style.transform = `translate(${P1 - 3}px, ${TOP - 1}px) rotate(${ang}deg) scaleY(${Math.max(1, len).toFixed(1)})`; };
        const drawHero = (bob, rot) => { hero.style.transform = `translate(${(hx - 22).toFixed(1)}px, ${(TOP - 44 - (bob || 0)).toFixed(1)}px) rotate(${rot || 0}deg)`; };
        const reset = () => {
          len = 0;
          hx = P1 - 30;
          drawStick(0);
          drawHero();
          hero.animate([{ transform: `translate(${hx - 22}px, ${TOP - 240}px) scale(1,1)` }, { transform: `translate(${hx - 22}px, ${TOP - 44}px) scale(1.25,.75)`, offset: 0.75 },
                        { transform: `translate(${hx - 22}px, ${TOP - 44}px) scale(1,1)` }], { duration: 420, easing: 'ease-in' });
          state = 'ready';
        };
        const grow = () => { if (state === 'ready' && !g.over) { state = 'grow'; lastTick = 0; } };
        const drop = () => {
          if (state !== 'grow') return;
          state = 'fall';
          stick.animate([{ transform: `translate(${P1 - 3}px, ${TOP - 1}px) rotate(0deg) scaleY(${len})`, easing: 'cubic-bezier(.5,0,1,.5)' },
                         { transform: `translate(${P1 - 3}px, ${TOP - 1}px) rotate(90deg) scaleY(${len})`, offset: 0.8, easing: 'ease-out' },
                         { transform: `translate(${P1 - 3}px, ${TOP - 1}px) rotate(84deg) scaleY(${len})`, offset: 0.9, easing: 'ease-in' },
                         { transform: `translate(${P1 - 3}px, ${TOP - 1}px) rotate(90deg) scaleY(${len})` }], { duration: 440, fill: 'forwards' })
            .finished.then(() => {
              if (g.over) return;
              const tip = P1 + len;
              ok = tip >= x2 && tip <= x2 + w2;
              g.sfx('thud');
              g.shake(ok ? 5 : 3);
              g.dust(tip, TOP, 7);
              if (ok && Math.abs(tip - mid) <= 10) { g.say(T.games.perfect, 'small'); g.note(784, 260); }
              target = ok ? mid : tip;
              state = 'walk';
            }, () => {});
        };
        g.loop(dt => {
          clock += dt;
          if (state === 'grow') {
            len = Math.min(1000, len + 560 * dt);
            drawStick(0);
            if (len - lastTick > 40) { lastTick = len; g.note(300 + len * 0.9, 50); }   // rising pips while it grows
          } else if (state === 'walk') {
            hx = Math.min(target, hx + 340 * dt);
            drawHero(Math.abs(Math.sin(clock * 16)) * 7, Math.sin(clock * 16) * 6);
            if (hx >= target) {
              drawHero();
              if (ok) { state = 'done'; arrive(); } else { state = 'lost'; plunge(); }
            }
          }
        });
        const plunge = () => {   // off the end: the bridge and the seal go down, then try again
          g.sfx('sad');
          g.say(T.games.miss, 'small');
          stick.animate([{ transform: `translate(${P1 - 3}px, ${TOP - 1}px) rotate(90deg) scaleY(${len})` },
                         { transform: `translate(${P1 - 3}px, ${TOP - 1}px) rotate(180deg) scaleY(${len})` }], { duration: 380, easing: 'ease-in', fill: 'forwards' });
          hero.animate([{ transform: `translate(${hx - 22}px, ${TOP - 44}px) rotate(0deg)` }, { transform: `translate(${hx - 2}px, ${H + 60}px) rotate(160deg)` }],
                       { duration: 520, easing: 'cubic-bezier(.5,0,1,.5)', fill: 'forwards' });
          g.after(950, () => { stick.getAnimations().forEach(a => a.cancel()); hero.getAnimations().forEach(a => a.cancel()); reset(); });
        };
        const arrive = () => {   // a little hop, then the camera flies into the next slide until it is the screen
          g.sfx('coin');
          hero.animate([{ transform: `translate(${hx - 22}px, ${TOP - 44}px) scale(1.2,.8)` }, { transform: `translate(${hx - 22}px, ${TOP - 110}px) scale(.9,1.1)`, offset: 0.45 },
                        { transform: `translate(${hx - 22}px, ${TOP - 44}px) scale(1,1)` }], { duration: 420, easing: 'ease-out' });
          g.after(380, () => {
            g.sfx('whoosh', 700);
            cam.animate([{ transform: 'translate(0px, 0px) scale(1)' }, { transform: `translate(${-sx / S}px, ${-sy / S}px) scale(${1 / S})` }],
                        { duration: 750, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' });
          });
          g.after(1150, () => g.win());
        };
        g.listen(g.root, 'pointerdown', grow);
        g.listen(window, 'pointerup', drop);
        g.listen(window, 'keyup', e => { if (isKey(e, ...GO, ...FWD)) drop(); });
        g.key = e => { if (!e.repeat && isKey(e, ...GO, ...FWD)) grow(); };
        drawStick(0);
        drawHero();
      },
    },
    toss: {   // crumple the old slide into a ball and throw it in the bin: aim, then power, and mind the wind (after Paper Toss)
      seamless: true,
      play(g) {
        const GR = 1500, FLOOR = 660, BW = 150, BTOP = 470, R = 34, X0 = 190, Y0 = FLOOR - R;
        const BX = rnd(800, 1060), wind = Math.round(rnd(-3, 3)) * 60, SX = 2 * R / W, SY = 2 * R / H;
        g.add(g.view(g.to, 0, 0, 0, W, H));
        const scene = g.add(make('div', { className: 'g-scene' }));
        scene.appendChild(make('div', { className: 'g-room' }));
        const binBack = scene.appendChild(make('div', { className: 'g-bin-back' }));
        binBack.style.cssText = `left:${BX - BW / 2}px;top:${BTOP - 14}px;width:${BW}px`;
        const wrinkle = make('i', { className: 'wrinkle' });
        const ball = scene.appendChild(make('div', { className: 'g-paper' }, g.view(g.from, g.fromStep, 0, 0, W, H), wrinkle));
        const binFront = scene.appendChild(make('div', { className: 'g-bin' }));
        binFront.style.cssText = `left:${BX - BW / 2 - 6}px;top:${BTOP}px;width:${BW + 12}px;height:${FLOOR - BTOP + 14}px`;
        const aimEl = scene.appendChild(make('div', { className: 'g-aim' }));
        aimEl.style.cssText = `left:${X0}px;top:${Y0 - 4}px`;
        const meter = scene.appendChild(make('div', { className: 'g-meter' }, make('i')));
        meter.style.cssText = `left:${X0 - 90}px;top:${Y0 - 190}px`;
        const arrows = wind ? (wind > 0 ? '→' : '←').repeat(Math.abs(wind) / 60) : '·';
        scene.appendChild(make('div', { className: 'g-wind', textContent: `${T.games.wind} ${arrows}` }));
        const dots = Array.from({ length: 14 }, () => scene.appendChild(make('b', { className: 'g-dot' })));
        const tf = (x, y, a, k) => `translate(${(x - W / 2).toFixed(1)}px, ${(y - H / 2).toFixed(1)}px) rotate(${a.toFixed(1)}deg) scale(${SX * (k || 1)}, ${SY * (k || 1)})`;
        let state = 'crumple', th = 45, pw = 0, clock = 0, x = X0, y = Y0, vx = 0, vy = 0, a = 200, spin = 0, throws = 0, bounced = false;
        const place = () => { ball.style.transform = tf(x, y, a); };
        // the crumple: the slide is squeezed into a ball, crackling
        ball.animate([{ transform: 'translate(0px, 0px) rotate(0deg) scale(1, 1)', borderRadius: '0%' },
                      { transform: `translate(${((X0 - W / 2) * 0.3).toFixed(0)}px, ${((Y0 - H / 2) * 0.3).toFixed(0)}px) rotate(-25deg) scale(.45, .55)`, borderRadius: '18%', offset: 0.45 },
                      { transform: tf(X0, Y0, 200), borderRadius: '50%' }], { duration: 800, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
        wrinkle.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 800, fill: 'forwards' });
        g.sfx('tear');
        g.after(300, () => g.sfx('tear'));
        g.after(820, () => {
          ball.getAnimations().forEach(an => an.cancel());
          ball.style.borderRadius = '50%';
          wrinkle.getAnimations().forEach(an => an.cancel());
          wrinkle.style.opacity = 1;
          place();
          state = 'aim';
          clock = 0;
        });
        const preview = (ang, p) => {   // after two misses, the path is shown
          const show = throws >= 2 && (state === 'aim' || state === 'power');
          let px = X0, py = Y0, v = 650 + p * 950, r = ang * Math.PI / 180, pvx = v * Math.cos(r), pvy = -v * Math.sin(r);
          dots.forEach(d => {
            for (let k = 0; k < 4; k++) { pvx += wind * 0.02; pvy += GR * 0.02; px += pvx * 0.02; py += pvy * 0.02; }
            d.style.transform = `translate(${px.toFixed(0)}px, ${py.toFixed(0)}px)`;
            d.style.opacity = show && py < FLOOR ? 0.7 : 0;
          });
        };
        const clang = () => { g.play({ type: 'square', f: 1900, f2: 1400, gain: 0.05, dur: 90 }); g.play({ type: 'noise', filter: 'bandpass', ff: 3200, q: 6, gain: 0.25, dur: 60 }); g.shake(3); };
        const newBall = () => {
          x = X0; y = Y0; a = 200; bounced = false;
          place();
          ball.animate([{ transform: tf(X0, Y0, 200, 0.01) }, { transform: tf(X0, Y0, 200, 1.25) }, { transform: tf(X0, Y0, 200) }], { duration: 300, easing: 'ease-out' });
          aimEl.style.opacity = 1;
          meter.classList.remove('on');
          meter.firstChild.style.transform = 'scaleY(0)';
          state = 'aim';
          clock = 0;
        };
        const miss = () => { state = 'wait'; throws++; g.say(T.games.miss, 'small'); g.after(800, newBall); };
        const score = () => {
          state = 'in';
          ball.animate([{ transform: tf(x, y, a) }, { transform: tf(BX, BTOP + 90, a + 160, 0.9) }], { duration: 280, easing: 'ease-in', fill: 'forwards' });
          binFront.animate([0, -5, 4, -3, 2, 0].map(r => ({ transform: `rotate(${r}deg)` })), { duration: 500, delay: 200 });
          g.after(200, () => { g.dust(BX, BTOP, 12); g.shake(5); g.play({ type: 'noise', filter: 'lowpass', ff: 700, gain: 0.4, dur: 160 }); });
          g.note(784, 180);
          g.after(130, () => g.note(1047, 300));
          g.say(throws === 0 ? T.games.perfect : T.games.swish, 'small');
          g.after(700, () => scene.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' }));
          g.after(1150, () => g.win());
        };
        g.loop(dt => {
          clock += dt;
          if (state === 'aim') {
            th = 45 + 28 * Math.sin(clock * 3.2);
            aimEl.style.transform = `rotate(${(-th).toFixed(1)}deg)`;
            preview(th, 0.55);
          } else if (state === 'power') {
            pw = 0.5 - 0.5 * Math.cos(clock * 4.6);
            meter.firstChild.style.transform = `scaleY(${pw.toFixed(3)})`;
            preview(th, pw);
          } else if (state === 'fly') {
            for (let k = 0; k < 3 && state === 'fly'; k++) {
              const h = dt / 3, px = x, py = y;
              vx += wind * h; vy += GR * h; x += vx * h; y += vy * h; a += spin * h;
              for (const rx of [BX - BW / 2, BX + BW / 2]) {   // off the rim
                const dx = x - rx, dy = y - BTOP, d = Math.hypot(dx, dy);
                if (d > 0 && d < R + 4) {
                  const nx = dx / d, ny = dy / d, dot = vx * nx + vy * ny;
                  if (dot < 0) { vx -= 1.6 * dot * nx; vy -= 1.6 * dot * ny; x = rx + nx * (R + 4); y = BTOP + ny * (R + 4); clang(); }
                }
              }
              if (py < BTOP && y >= BTOP && x > BX - BW / 2 + R * 0.5 && x < BX + BW / 2 - R * 0.5 && vy > 0) { score(); break; }
              if (y > BTOP && Math.abs(x - BX) < BW / 2 + R && Math.abs(px - BX) >= BW / 2 + R - 1) { vx = -vx * 0.5; x = px; clang(); }   // off the side
              if (y > FLOOR - R) {   // the floor: bounce, roll, stop
                y = FLOOR - R;
                if (!bounced) { g.dust(x, FLOOR, 5); g.play({ type: 'noise', filter: 'lowpass', ff: 500, gain: 0.3, dur: 80 }); }
                bounced = true;
                vy = -vy * 0.38; vx *= 0.7; spin *= 0.7;
                if (Math.abs(vy) < 90 && Math.abs(vx) < 60) miss();
              }
              if (x < -120 || x > W + 120) miss();
            }
            place();
          }
        });
        const press = () => {
          if (g.over) return;
          if (state === 'aim') { state = 'power'; clock = 0; meter.classList.add('on'); g.tick(); }
          else if (state === 'power') {
            const v = 650 + pw * 950, r = th * Math.PI / 180;
            vx = v * Math.cos(r); vy = -v * Math.sin(r); spin = 500 + v * 0.4;
            aimEl.style.opacity = 0;
            dots.forEach(d => { d.style.opacity = 0; });
            state = 'fly';
            g.sfx('whoosh', 350);
          }
        };
        g.listen(g.root, 'pointerdown', press);
        g.key = e => { if (!e.repeat && isKey(e, ...GO, ...FWD)) press(); };
      },
    },
    hero: {   // two lanes, the Hall of the Mountain King (Grieg, public domain), faster and faster: you play the tune; the slide lights up with it
      seamless: true,
      play(g) {
        const Bn = 247, Cs = 277, D = 294, E = 330, Fs = 370, F = 349, C = 262, B4 = 494, A = 440;
        const tune = [[Bn, 1], [Cs, 1], [D, 1], [E, 1], [Fs, 1], [D, 1], [Fs, 2], [F, 1], [Cs, 1], [F, 2], [E, 1], [C, 1], [E, 2],
                      [Bn, 1], [Cs, 1], [D, 1], [E, 1], [Fs, 1], [D, 1], [Fs, 1], [B4, 1], [A, 1], [Fs, 1], [D, 1], [Fs, 1], [A, 3]];
        const HIT = 600, TRAVEL = 1300, OK = 170, PERF = 70, LX = [520, 760];
        let tempo = 1, notes = [], t0 = 0, hits = 0, combo = 0, done = false;
        g.add(g.view(g.to, 0, 0, 0, W, H));
        const veil = g.add(make('div', { className: 'g-veil' }));
        const stage = g.add(make('div', { className: 'g-stage' }));
        const lanes = LX.map((x, i) => {
          stage.appendChild(make('div', { className: 'g-lane' })).style.left = (x - 70) + 'px';
          const z = stage.appendChild(make('div', { className: 'g-hitzone l' + i, textContent: i ? '→' : '←' }));
          z.style.cssText = `left:${x - 44}px;top:${HIT - 44}px`;
          return z;
        });
        const comboEl = stage.appendChild(make('div', { className: 'g-combo' }));
        const progress = () => {
          veil.style.opacity = (0.9 * (1 - hits / notes.length)).toFixed(3);
          g.status(`${hits} / ${notes.length}`);
          comboEl.textContent = combo >= 3 ? combo + ' combo' : '';
        };
        const label = (lane, text, cls) => {
          const el = stage.appendChild(make('div', { className: 'g-judge ' + (cls || ''), textContent: text }));
          el.style.left = LX[lane] + 'px';
          el.style.top = (HIT - 90) + 'px';
          el.animate([{ transform: 'translate(-50%, 10px) scale(.6)', opacity: 0 }, { transform: 'translate(-50%, 0px) scale(1.15)', opacity: 1, offset: 0.3 },
                      { transform: 'translate(-50%, -30px) scale(1)', opacity: 0 }], { duration: 600, fill: 'forwards' }).finished.then(() => el.remove(), () => {});
        };
        const setup = () => {
          stage.querySelectorAll('.g-gem').forEach(e => e.remove());
          let t = 1600;
          notes = tune.map(([f, b], i) => {
            const eighth = (200 - 70 * i / (tune.length - 1)) / tempo;   // it speeds up, as the piece does
            const n = { f, b, at: t, dur: eighth * b, lane: f > E ? 1 : 0, done: false, missed: false };
            n.el = stage.appendChild(make('div', { className: 'g-gem l' + n.lane + (b > 1 ? ' long' : '') }));
            n.el.style.transform = 'translate(-100px, -100px)';
            t += eighth * b;
            return n;
          });
          hits = 0; combo = 0; done = false;
          t0 = performance.now();
          for (let i = 0; i < 4; i++) g.after(1600 - (4 - i) * 240 / tempo, () => g.play({ type: 'noise', filter: 'highpass', ff: 4000, gain: 0.18, dur: 20 }));   // count-in
          progress();
        };
        const judge = lane => {
          if (done || g.over) return;
          const now = performance.now() - t0;
          let best = null;
          for (const n of notes) if (!n.done && (lane === null || n.lane === lane) && Math.abs(n.at - now) <= OK && (!best || Math.abs(n.at - now) < Math.abs(best.at - now))) best = n;
          if (!best) { g.play({ type: 'sine', f: 110, gain: 0.08, dur: 60 }); return; }   // a swing at nothing
          best.done = true;
          hits++;
          combo++;
          const perfect = Math.abs(best.at - now) <= PERF;
          if (perfect) g.perfects++;
          g.play({ type: 'square', f: best.f, gain: 0.08, dur: Math.max(130, best.dur * 0.95) });
          g.play({ type: 'triangle', f: best.f / 2, gain: 0.12, dur: Math.max(130, best.dur) });
          best.el.animate([{ transform: `translate(${LX[best.lane] - 30}px, ${HIT - 30}px) scale(1)`, opacity: 1 }, { transform: `translate(${LX[best.lane] - 30}px, ${HIT - 30}px) scale(2.2)`, opacity: 0 }],
                          { duration: 260, fill: 'forwards' }).finished.then(() => best.el.remove(), () => {});
          lanes[best.lane].animate([{ transform: 'scale(1.25)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 200 });
          label(best.lane, perfect ? T.games.perfectShort : T.games.good, perfect ? 'perfect' : '');
          if (combo > 0 && combo % 8 === 0) { g.dust(LX[best.lane], HIT, 10); g.shake(3); }
          progress();
        };
        g.loop(() => {
          if (done) return;
          const now = performance.now() - t0;
          for (const n of notes) {
            if (n.done && !n.missed) continue;
            const yy = HIT - (n.at - now) / TRAVEL * (HIT + 60);
            if (!n.done && now - n.at > OK) {   // gone past: a miss, a scratch
              n.done = true; n.missed = true; combo = 0; g.misses++;
              n.el.classList.add('miss');
              label(n.lane, T.games.miss, 'miss');
              g.play({ type: 'sawtooth', f: 180, f2: 60, gain: 0.06, dur: 160 });
              progress();
            }
            if (yy > H + 60) { if (n.el.isConnected) n.el.remove(); continue; }
            n.el.style.transform = `translate(${LX[n.lane] - 30}px, ${(yy - 30).toFixed(1)}px)`;
          }
          const last = notes[notes.length - 1];
          if (notes.every(n => n.done) && now > last.at + 700) {
            done = true;
            if (hits >= notes.length * 0.6) {
              stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
              veil.animate([{ opacity: +veil.style.opacity }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
              g.win();
            } else { g.say(T.games.again); tempo *= 0.85; g.after(1000, setup); }   // again, a little slower
          }
        });
        const LEFT = ['ArrowLeft', 'PageUp', 'a', 'q', 'f'], RIGHT = ['ArrowRight', 'PageDown', 'd', 'l', 'j'];
        g.listen(g.root, 'pointerdown', e => judge(g.point(e)[0] < W / 2 ? 0 : 1));
        g.key = e => {
          if (e.repeat) return;
          if (isKey(e, ...LEFT)) judge(0);
          else if (isKey(e, ...RIGHT)) judge(1);
          else if (isKey(e, ...GO)) judge(null);   // one button: the nearest note, either lane
        };
        setup();
      },
    },
    slice: {   // the old slide flies up in pieces: slice them before they fall (after Fruit Ninja) -- not the bomb
      seamless: true,
      play(g) {
        const cols = 4, rows = 3, pw = W / cols, ph = H / rows, S = 0.62, GOAL = 9, GRAV = 1500;
        g.add(g.view(g.to, 0, 0, 0, W, H));
        const veil = g.add(make('div', { className: 'g-veil' }));
        const queue = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) queue.push({ c, r });
        shuffle(queue);
        queue.forEach(q => {   // the slide cracks and drops away
          const v = g.add(g.view(g.from, g.fromStep, q.c * pw, q.r * ph, pw, ph));
          v.animate([{ transform: `translate(${q.c * pw}px, ${q.r * ph}px) rotate(0deg)` }, { transform: `translate(${q.c * pw + rnd(-60, 60)}px, ${H + 60}px) rotate(${rnd(-40, 40)}deg)` }],
                    { duration: rnd(500, 800), delay: 200 + rnd(0, 250), easing: 'cubic-bezier(.5,0,1,.6)', fill: 'both' }).finished.then(() => v.remove(), () => {});
        });
        g.sfx('crash');
        const trailSvg = g.add(make('div', { className: 'g-trail', innerHTML: `<svg viewBox="0 0 ${W} ${H}"><polyline/></svg>` }));
        const poly = trailSvg.querySelector('polyline');
        const items = [];
        let sliced = 0, launched = 0, recent = [], trail = [], last = null;
        const view = q => g.view(g.from, g.fromStep, q.c * pw, q.r * ph, pw, ph);
        const put = it => { it.el.style.transform = `translate(${(it.x - (it.bomb ? 45 : pw / 2)).toFixed(1)}px, ${(it.y - (it.bomb ? 45 : ph / 2)).toFixed(1)}px) rotate(${it.a.toFixed(1)}deg) scale(${it.bomb ? 1 : S})`; };
        const launch = () => {
          if (g.over || sliced >= GOAL) return;
          const n = 1 + Math.floor(rnd(0, sliced > 4 ? 3.2 : 2.2));
          for (let i = 0; i < n; i++) {
            const bomb = launched > 2 && Math.random() < 0.16, q = bomb ? null : queue.shift();
            if (!bomb && !q) break;
            const el = g.add(bomb ? make('div', { className: 'g-bomb' }, make('i')) : view(q));
            if (!bomb) el.classList.add('g-piece');
            const x = rnd(220, W - 220);
            const it = { el, q, bomb, x, y: H + 90, vx: (W / 2 - x) * rnd(0.25, 0.7) + rnd(-80, 80), vy: -rnd(1080, 1260), a: rnd(-20, 20), va: rnd(-160, 160), alive: true, r: bomb ? 50 : ph * S * 0.55 };
            put(it);
            items.push(it);
            launched++;
          }
          g.play({ type: 'noise', filter: 'lowpass', ff: 400, gain: 0.25, dur: 120 });   // a thump from below
          g.after(rnd(900, 1300), launch);
        };
        g.after(1000, launch);
        const juice = (x, y) => {
          for (let i = 0; i < 10; i++) {
            const d = g.add(make('div', { className: 'g-juice j' + (i % 3) })), a = rnd(0, 2 * Math.PI), r = rnd(60, 160);
            d.style.left = x + 'px';
            d.style.top = y + 'px';
            d.animate([{ transform: 'translate(0px, 0px) scale(1)', opacity: 1 }, { transform: `translate(${(Math.cos(a) * r).toFixed(0)}px, ${(Math.sin(a) * r + 60).toFixed(0)}px) scale(.3)`, opacity: 0 }],
                      { duration: rnd(350, 600), easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' }).finished.then(() => d.remove(), () => {});
          }
        };
        const cutItem = (it, ang) => {
          it.alive = false;
          it.el.remove();
          if (it.bomb) {   // boom: two pieces back
            g.sfx('boom');
            g.shake(14);
            const f = g.add(make('div', { className: 'rw-flash' }));
            f.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).finished.then(() => f.remove(), () => {});
            g.say(T.games.boom, 'small');
            g.misses++;
            sliced = Math.max(0, sliced - 2);
            g.status(`${sliced} / ${GOAL}`);
            return;
          }
          sliced++;
          const now = performance.now();
          recent = recent.filter(t => now - t < 300).concat([now]);
          if (recent.length >= 3) { g.say(T.games.combo + ' ×' + recent.length, 'small'); g.perfects++; }
          const across = Math.abs(Math.cos(ang)) > Math.abs(Math.sin(ang));   // a sideways cut splits top from bottom
          [[across ? 'inset(0% 0% 50% 0%)' : 'inset(0% 50% 0% 0%)', -1], [across ? 'inset(50% 0% 0% 0%)' : 'inset(0% 0% 0% 50%)', 1]].forEach(([clip, s]) => {
            const h = g.add(view(it.q));
            h.style.clipPath = clip;
            const sx = across ? 0 : s * 160, sy = across ? s * 120 : 0, base = `translate(${(it.x - pw / 2).toFixed(0)}px, ${(it.y - ph / 2).toFixed(0)}px)`;
            h.animate([{ transform: `${base} rotate(${it.a.toFixed(0)}deg) scale(${S})` },
                       { transform: `${base} translate(${sx * 0.6}px, ${sy * 0.6 - 60}px) rotate(${(it.a + s * 40).toFixed(0)}deg) scale(${S})`, offset: 0.35 },
                       { transform: `${base} translate(${sx}px, ${H - it.y + 200}px) rotate(${(it.a + s * 120).toFixed(0)}deg) scale(${S})` }],
                      { duration: 900, easing: 'cubic-bezier(.3,0,.8,.6)', fill: 'forwards' }).finished.then(() => h.remove(), () => {});
          });
          juice(it.x, it.y);
          g.play({ type: 'noise', filter: 'bandpass', ff: 2500, ff2: 7000, q: 2, gain: 0.35, dur: 90 });
          g.note(523 * Math.pow(2, Math.min(recent.length - 1, 6) / 6), 120);
          veil.style.opacity = (0.85 * (1 - sliced / GOAL)).toFixed(3);
          g.status(`${sliced} / ${GOAL}`);
          if (sliced >= GOAL && !g.over) {
            items.filter(o => o.alive).forEach(o => { o.alive = false; o.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }); });
            g.win();
          }
        };
        const cut = (x1, y1, x2, y2, reach) => {   // everything whose centre is within reach of the segment
          const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1, ang = Math.atan2(dy, dx);
          for (const it of items) {
            if (!it.alive) continue;
            const k = Math.max(0, Math.min(1, ((it.x - x1) * dx + (it.y - y1) * dy) / L2));
            if (Math.hypot(it.x - x1 - k * dx, it.y - y1 - k * dy) < (reach || it.r)) cutItem(it, ang);
          }
        };
        g.listen(g.root, 'pointermove', e => {   // a fast stroke, or a drag, is a blade
          const [px, py] = g.point(e), now = performance.now();
          if (last) {
            const sp = Math.hypot(px - last.x, py - last.y) / Math.max(0.001, (now - last.t) / 1000);
            if (e.buttons || sp > 700) { trail.push({ x: px, y: py, t: now }); cut(last.x, last.y, px, py); }
          }
          last = { x: px, y: py, t: now };
        });
        const slash = () => {   // one button: a sword stroke through the highest piece in the air
          const up = items.filter(it => it.alive && !it.bomb && it.y < H - 40);
          const tgt = up.length ? up.reduce((p, q) => (p.y < q.y ? p : q)) : { x: W / 2, y: H / 2 };
          const ang = rnd(-0.45, 0.45), dx = Math.cos(ang) * 1600, dy = Math.sin(ang) * 1600;
          const bar = g.add(make('div', { className: 'g-slash' }));
          bar.style.cssText = `left:${tgt.x}px;top:${tgt.y}px`;
          bar.animate([{ transform: `translate(-50%, -50%) rotate(${ang}rad) scaleX(0)`, opacity: 1 }, { transform: `translate(-50%, -50%) rotate(${ang}rad) scaleX(1)`, opacity: 1, offset: 0.4 },
                       { transform: `translate(-50%, -50%) rotate(${ang}rad) scaleX(1)`, opacity: 0 }], { duration: 260, fill: 'forwards' }).finished.then(() => bar.remove(), () => {});
          g.play({ type: 'noise', filter: 'bandpass', ff: 1500, ff2: 6000, q: 1.5, gain: 0.3, dur: 140 });
          cut(tgt.x - dx, tgt.y - dy, tgt.x + dx, tgt.y + dy, 85);
        };
        g.key = e => { if (!e.repeat && isKey(e, ...GO, ...FWD)) slash(); };
        g.loop(dt => {
          for (const it of items) {
            if (!it.alive) continue;
            it.vy += GRAV * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.a += it.va * dt;
            if (it.y > H + 140 && it.vy > 0) { it.alive = false; it.el.remove(); if (it.q) queue.push(it.q); continue; }   // missed: it comes round again
            put(it);
          }
          const now = performance.now();
          trail = trail.filter(p => now - p.t < 140);
          poly.setAttribute('points', trail.map(p => p.x.toFixed(0) + ',' + p.y.toFixed(0)).join(' '));
        });
        g.status(`0 / ${GOAL}`);
      },
    },
    run: {   // run across the old slide's title: its words are the hurdles; hold to jump higher; the floating ones, go under (after Chrome's dinosaur)
      seamless: true,
      play(g) {
        const GROUND = 560, HX = 230, S = 0.3, clean = w => w.replace(/[^\p{L}\p{N}]/gu, '');
        let words = (titleOf(g.from) || '').split(/\s+/).filter(w => clean(w).length > 1);
        if (words.length < 4) words = words.concat(T.games.words);
        const world = g.add(make('div', { className: 'g-runworld' }));
        const far = world.appendChild(make('div', { className: 'g-far' }));
        world.appendChild(make('div', { className: 'g-ground' })).style.top = GROUND + 'px';
        const track = world.appendChild(make('div', { className: 'g-track' }));
        const obs = [];
        let pos = 950;
        const n = Math.min(8, Math.max(5, words.length));
        for (let i = 0; i < n; i++) {
          const fly = i > 1 && Math.random() < 0.3;
          const el = track.appendChild(make('div', { className: 'g-word' + (fly ? ' fly' : ''), textContent: words[i % words.length] }));
          obs.push({ el, x: pos, fly, hit: false, passed: false });
          pos += rnd(460, 640);
        }
        obs.forEach(o => {   // measured once they are in the page
          o.w = o.el.offsetWidth;
          o.h = o.el.offsetHeight;
          o.y = o.fly ? GROUND - 150 - o.h : GROUND - o.h;
          o.el.style.left = o.x + 'px';
          o.el.style.top = o.y + 'px';
        });
        const finish = pos + 200, BW2 = W * S, BH2 = H * S, by = GROUND - BH2 - 50;
        track.appendChild(make('div', { className: 'g-post' })).style.cssText = `left:${finish + BW2 / 2 - 4}px;top:${GROUND - 50}px;height:50px`;
        const board = track.appendChild(g.view(g.to, 0, 0, 0, W, H));
        board.classList.add('g-board');
        board.style.transform = `translate(${finish}px, ${by}px) scale(${S})`;
        const hero = world.appendChild(make('div', { className: 'g-hero' }));
        let scroll = 0, speed = 400, hy = 0, vy = 0, grounded = true, held = false, stun = 0, cleared = 0, clock = 0, state = 'run';
        const jump = () => {
          if (!grounded || g.over || state !== 'run') return;
          grounded = false;
          vy = 900;
          g.play({ type: 'square', f: 320, f2: 700, gain: 0.06, dur: 120 });
        };
        const arrive = () => {   // into the next slide, as with the bridge
          state = 'done';
          g.sfx('coin');
          const bx = finish - scroll;
          world.animate([{ transform: 'translate(0px, 0px) scale(1)' }, { transform: `translate(${(-bx / S).toFixed(1)}px, ${(-by / S).toFixed(1)}px) scale(${1 / S})` }],
                        { duration: 750, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' });
          g.after(800, () => g.win());
        };
        g.loop(dt => {
          if (state !== 'run') return;
          clock += dt;
          if (stun > 0) stun -= dt;
          speed = Math.min(620, speed + 14 * dt);
          scroll += (stun > 0 ? 110 : speed) * dt;
          track.style.transform = `translateX(${(-scroll).toFixed(1)}px)`;
          far.style.backgroundPosition = `${(-scroll * 0.25).toFixed(1)}px 0px`;
          if (!grounded) {   // held, it floats up higher; let go, it drops
            vy -= (held && vy > 0 ? 1900 : 3600) * dt;
            hy += vy * dt;
            if (hy <= 0) { hy = 0; vy = 0; grounded = true; g.dust(HX, GROUND, 4); hero.animate([{ transform: `translate(${HX - 22}px, ${GROUND - 44}px) scale(1.3, .7)` }, { transform: `translate(${HX - 22}px, ${GROUND - 44}px) scale(1, 1)` }], { duration: 160 }); }
          }
          const bob = grounded ? Math.abs(Math.sin(clock * 18)) * 5 : 0;
          hero.style.transform = `translate(${HX - 22}px, ${(GROUND - 44 - hy - bob).toFixed(1)}px) rotate(${grounded ? Math.sin(clock * 18) * 6 : -vy * 0.02}deg)`;
          const top = GROUND - 44 - hy + 6, bottom = GROUND - hy, left = HX - 18, right = HX + 18;
          for (const o of obs) {
            const ox = o.x - scroll;
            if (!o.hit && right > ox + 6 && left < ox + o.w - 6 && bottom > o.y + 4 && top < o.y + o.h - 4) {   // bumped: a stumble, not a game over
              o.hit = true;
              stun = 0.45;
              g.say(T.games.ouch, 'small');
              g.sfx('thud');
              g.shake(8);
              o.el.animate([{ transform: 'translate(0px, 0px) rotate(0deg)' }, { transform: `translate(${rnd(200, 400)}px, -300px) rotate(${rnd(90, 300)}deg)`, opacity: 0 }],
                           { duration: 700, easing: 'ease-out', fill: 'forwards' });
            }
            if (!o.passed && ox + o.w < HX - 22) {
              o.passed = true;
              if (!o.hit) { cleared++; g.note(660 + cleared * 70, 100); }
              g.status(`${obs.filter(q => q.passed).length} / ${obs.length}`);
            }
          }
          if (finish - scroll < HX + 30 && grounded) arrive();
        });
        g.status(`0 / ${obs.length}`);
        const down = () => { held = true; jump(); };
        g.listen(g.root, 'pointerdown', down);
        g.listen(window, 'pointerup', () => { held = false; });
        g.listen(window, 'keyup', e => { if (isKey(e, ...GO, ...FWD, 'ArrowUp')) held = false; });
        g.key = e => { if (!e.repeat && isKey(e, ...GO, ...FWD, 'ArrowUp')) down(); };
      },
    },
    taquin: {   // a 3 x 3 sliding puzzle of the next slide, a few moves from solved
      play(g) {
        const C = 3, w = W / C, h = H / C, pos = [0, 1, 2, 3, 4, 5, 6, 7, 8], history = [];   // pos[tile] = cell; tile 8 is the hole
        const xy = c => [(c % C) * w, Math.floor(c / C) * h];
        const touching = (a, b) => Math.abs(a % C - b % C) + Math.abs(Math.floor(a / C) - Math.floor(b / C)) === 1;
        const tiles = [];
        const place = i => { const [x, y] = xy(pos[i]); tiles[i].style.transform = `translate(${x + 3}px, ${y + 3}px)`; };
        const move = (c, undo) => {   // the tile in cell c slides into the hole, if they touch
          const hc = pos[8];
          if (!touching(c, hc)) return false;
          const i = pos.indexOf(c);
          pos[i] = hc;
          pos[8] = c;
          if (tiles[i]) place(i);
          if (!undo) history.push(hc);
          return true;
        };
        const solved = () => pos.every((c, i) => c === i);
        do {
          let last = -1;
          for (let k = 0; k < 7; k++) {
            const hc = pos[8], opts = [hc - 1, hc + 1, hc - C, hc + C].filter(c => c >= 0 && c < 9 && c !== last && touching(c, hc));
            last = hc;
            move(pick(opts));
          }
        } while (solved());
        g.add(make('div', { className: 'g-well' }));
        for (let i = 0; i < 8; i++) {
          const [x, y] = xy(i), v = g.add(g.view(g.to, 0, x + 3, y + 3, w - 6, h - 6));
          v.classList.add('g-slide');
          tiles[i] = v;
          place(i);
          v.addEventListener('pointerdown', () => { if (move(pos[i])) after(); });
        }
        const after = () => {
          g.sfx('clack');
          if (!solved()) return;
          const [x, y] = xy(8), last = g.add(g.view(g.to, 0, x + 3, y + 3, w - 6, h - 6));
          last.style.transform = `translate(${x + 3}px, ${y + 3}px)`;
          last.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'both' });
          g.win();
        };
        g.key = e => {
          const hc = pos[8], col = hc % C;
          const c = isKey(e, 'ArrowLeft') && col < C - 1 ? hc + 1 : isKey(e, 'ArrowRight') && col > 0 ? hc - 1
                  : isKey(e, 'ArrowUp') ? hc + C : isKey(e, 'ArrowDown') ? hc - C : -1;
          if (c >= 0 && c < 9 && move(c)) after();
          else if (isKey(e, ' ', 'Enter', 'PageDown') && history.length) { move(history.pop(), true); after(); }   // a helping move
        };
      },
    },
    rotate: {   // the next slide in four quarters, each turned; turn them back upright
      play(g) {
        const w = W / 2, h = H / 2, ang = [0, 1, 2, 3].map(() => pick([90, 180, 270])), tiles = [];
        let sel = 0;
        g.add(make('div', { className: 'g-well' }));
        const show = () => tiles.forEach((v, i) => {
          const [x, y] = [(i % 2) * w, Math.floor(i / 2) * h];
          v.style.transform = `translate(${x + 5}px, ${y + 5}px) rotate(${ang[i]}deg) scale(${ang[i] % 180 ? 0.5625 : 1})`;
          v.classList.toggle('g-sel', i === sel && !g.over);
        });
        const turn = i => {
          ang[i] += 90;
          g.sfx('clack');
          if (ang[i] % 360 === 0) { const nxt = [1, 2, 3, 4].map(d => (i + d) % 4).find(j => ang[j] % 360); if (nxt !== undefined) sel = nxt; }
          if (ang.every(a => a % 360 === 0)) g.win();
          show();
        };
        for (let i = 0; i < 4; i++) {
          const v = g.add(g.view(g.to, 0, (i % 2) * w + 5, Math.floor(i / 2) * h + 5, w - 10, h - 10));
          v.classList.add('g-slide', 'g-turn');
          v.addEventListener('pointerdown', () => { sel = i; turn(i); });
          tiles.push(v);
        }
        show();
        g.key = e => {
          if (isKey(e, 'ArrowLeft', 'ArrowRight')) sel ^= 1;
          else if (isKey(e, 'ArrowUp', 'ArrowDown')) sel ^= 2;
          else if (isKey(e, ' ', 'Enter', 'PageDown')) turn(sel);
          else if (isKey(e, 'PageUp')) sel = (sel + 1) % 4;
          show();
        };
      },
    },
    breakout: {   // the top of the old slide is a wall of bricks; break half of it
      play(g) {
        const cols = 6, rows = 3, bw = W / cols, bh = 144, goal = 9, PW = 220, PY = 672, BS = 24;
        g.add(g.view(g.to, 0, 0, 0, W, H));
        const bricks = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const v = g.add(g.view(g.from, g.fromStep, c * bw + 2, r * bh + 2, bw - 4, bh - 4));
          v.classList.add('g-brick');
          v.style.transform = `translate(${c * bw + 2}px, ${r * bh + 2}px)`;
          bricks.push({ v, x: c * bw, y: r * bh, alive: true });
        }
        const pad = g.add(make('div', { className: 'g-paddle' })), ball = g.add(make('div', { className: 'g-ball' }));
        let px = (W - PW) / 2, target = null, bx = 0, by = 0, vx = 0, vy = 0, speed = 560, stuck = true, broken = 0;
        const held = {};
        const launch = () => { if (!stuck) return; stuck = false; const a = rnd(-0.5, 0.5); vx = speed * Math.sin(a); vy = -speed * Math.cos(a); };
        g.after(700, launch);
        g.listen(window, 'keyup', e => { held[e.key] = false; });
        g.listen(g.root, 'pointermove', e => { target = g.point(e)[0]; });
        g.listen(g.root, 'pointerdown', launch);
        g.key = e => { held[e.key] = true; target = null; if (isKey(e, ...GO)) launch(); };
        const fall = b => b.v.animate([{ transform: `translate(${b.x + 2}px, ${b.y + 2}px) rotate(0deg)`, opacity: 1 },
                                       { transform: `translate(${b.x + 2 + rnd(-80, 80)}px, ${H + 60}px) rotate(${rnd(-90, 90)}deg)`, opacity: 0.6 }],
                                      { duration: rnd(600, 900), easing: 'cubic-bezier(.5,0,1,.6)', fill: 'forwards' });
        g.loop(dt => {
          const dir = (held.ArrowRight || held.PageDown ? 1 : 0) - (held.ArrowLeft || held.PageUp ? 1 : 0);
          if (dir) px += dir * 900 * dt;
          else if (target !== null) px += (target - PW / 2 - px) * Math.min(1, dt * 18);
          px = Math.max(0, Math.min(W - PW, px));
          if (stuck) { bx = px + PW / 2 - BS / 2; by = PY - BS - 2; }
          else {
            bx += vx * dt;
            by += vy * dt;
            if (bx < 0) { bx = 0; vx = Math.abs(vx); }
            if (bx > W - BS) { bx = W - BS; vx = -Math.abs(vx); }
            if (by < 0) { by = 0; vy = Math.abs(vy); }
            if (vy > 0 && by + BS >= PY && by + BS <= PY + 22 && bx + BS > px && bx < px + PW) {
              // the angle follows where it hit the paddle, never straight up: a vertical ball would bounce
              // for ever in a column it has already cleared
              const off = Math.max(-1, Math.min(1, (bx + BS / 2 - px - PW / 2) / (PW / 2)));
              const a = (Math.abs(off) < 0.25 ? (off < 0 ? -0.25 : 0.25) + rnd(-0.05, 0.05) : off) * 1.05;
              vx = speed * Math.sin(a);
              vy = -speed * Math.cos(a);
              g.sfx('bleep');
            }
            if (by > H) { stuck = true; g.after(400, launch); }
            for (const b of bricks) {
              if (!b.alive || bx + BS < b.x || bx > b.x + bw || by + BS < b.y || by > b.y + bh) continue;
              b.alive = false;
              broken++;
              const fromSide = Math.min(bx + BS - b.x, b.x + bw - bx) < Math.min(by + BS - b.y, b.y + bh - by);
              if (fromSide) vx = -vx; else vy = -vy;
              speed = Math.min(820, speed + 18);
              fall(b);
              g.sfx('pop');
              if (broken >= goal) { bricks.filter(q => q.alive).forEach(q => { q.alive = false; fall(q); }); g.win(); }
              break;
            }
          }
          pad.style.transform = `translate(${px}px, ${PY}px)`;
          ball.style.transform = `translate(${bx}px, ${by}px)`;
        });
      },
    },
    catch: {   // a thumbnail of the next slide bounces around: click it, or strike when it crosses the ring
      play(g) {
        const S = 0.22, tw = W * S, th = H * S, R = 130;
        g.add(make('div', { className: 'g-dim' }));
        const ring = g.add(make('div', { className: 'g-ring' }));
        ring.style.cssText = `left:${W / 2 - R}px;top:${H / 2 - R}px;width:${2 * R}px;height:${2 * R}px`;
        const thumb = g.add(g.view(g.to, 0, 0, 0, W, H));
        thumb.classList.add('g-slide', 'g-thumb');
        let x = rnd(0, W - tw), y = rnd(80, H - th), a = rnd(0, 2 * Math.PI), v = 430;
        const inRing = () => Math.hypot(x + tw / 2 - W / 2, y + th / 2 - H / 2) < R - 20;
        thumb.addEventListener('pointerdown', () => g.win());
        g.key = e => {
          if (!isKey(e, ...GO, ...FWD)) return;
          if (inRing()) g.win();
          else { g.say(T.games.miss); g.sfx('zap'); v *= 1.08; }
        };
        g.loop(dt => {
          if (g.over) return;
          x += Math.cos(a) * v * dt;
          y += Math.sin(a) * v * dt;
          if (x < 0 || x > W - tw) { a = Math.PI - a; x = Math.max(0, Math.min(W - tw, x)); }
          if (y < 60 || y > H - th) { a = -a; y = Math.max(60, Math.min(H - th, y)); }
          thumb.style.transform = `translate(${x}px, ${y}px) scale(${S})`;
          ring.classList.toggle('hot', inRing());
        });
      },
    },
    mash: {   // push the old slide off the screen -- faster than it slides back
      seamless: true,
      play(g) {
        g.add(g.view(g.to, 0, 0, 0, W, H));
        const top = g.add(g.view(g.from, g.fromStep, 0, 0, W, H));
        top.classList.add('g-slide', 'g-lift');
        const bar = g.add(make('div', { className: 'g-bar' }, make('i')));
        let p = 0;
        const push = () => { if (g.over) return; p += 0.1; g.sfx('clack'); if (p >= 1) g.win(); };
        g.listen(g.root, 'pointerdown', push);
        g.key = e => { if (isKey(e, ...GO, ...FWD)) push(); };
        g.loop(dt => {
          if (!g.over) p = Math.max(0, p - 0.12 * dt);
          const q = Math.min(1, p);
          top.style.transform = `translateX(${-q * W * 1.05}px) rotate(${-q * 8}deg)`;
          bar.firstChild.style.transform = `scaleX(${q})`;
        });
      },
    },
    duel: {   // wait for it... FIRE! -- then shoot, not before
      play(g) {
        const sign = g.add(make('div', { className: 'g-sign', textContent: T.games.wait }));
        let state = 'wait', timer = 0;
        const arm = () => {
          state = 'wait';
          sign.textContent = T.games.wait;
          sign.classList.remove('fire');
          clearTimeout(timer);
          timer = g.after(rnd(1200, 3200), () => {
            state = 'fire';
            sign.textContent = T.games.fire;
            sign.classList.add('fire');
            g.sfx('zap');
            timer = g.after(900, () => { if (state === 'fire') { g.say(T.games.late); arm(); } });
          });
        };
        const shoot = () => {
          if (g.over) return;
          if (state === 'wait') { g.say(T.games.early); g.sfx('sad'); arm(); return; }
          state = 'done';
          clearTimeout(timer);
          g.sfx('boom');
          sign.classList.add('gone');
          for (let i = 0; i < 3; i++) {
            const hole = g.add(make('div', { className: 'g-hole' }));
            hole.style.left = rnd(200, W - 260) + 'px';
            hole.style.top = rnd(120, H - 200) + 'px';
          }
          g.win();
        };
        g.listen(g.root, 'pointerdown', shoot);
        g.key = e => { if (isKey(e, ...GO, ...FWD)) shoot(); };
        arm();
      },
    },
    memory: {   // three pairs of details of the next slide, face down
      play(g) {
        const cw = 340, chh = 191, gap = 30, left = (W - 3 * cw - 2 * gap) / 2, top = 170;
        const spots = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 3).map(k => [(k % 3) * 320, Math.floor(k / 3) * 180]);
        const deal = shuffle([0, 0, 1, 1, 2, 2]), up = [], done = [];
        let open = [], sel = 0;
        g.add(make('div', { className: 'g-dim' }));
        const cards = deal.map((kind, i) => {
          const face = g.view(g.to, 0, spots[kind][0], spots[kind][1], 640, 360);
          face.style.transform = `scale(${cw / 640})`;
          face.style.transformOrigin = '0 0';
          const card = g.add(make('div', { className: 'g-card' },
            make('div', { className: 'in' }, make('div', { className: 'back', textContent: '?' }), make('div', { className: 'front' }, face))));
          card.style.left = (left + (i % 3) * (cw + gap)) + 'px';
          card.style.top = (top + Math.floor(i / 3) * (chh + gap)) + 'px';
          card.addEventListener('pointerdown', () => { sel = i; flip(i); });
          return card;
        });
        const mark = () => cards.forEach((c, i) => { c.classList.toggle('up', !!up[i]); c.classList.toggle('g-sel', i === sel && !g.over); });
        const flip = i => {
          if (g.over || up[i] || open.length === 2) return;
          up[i] = true;
          open.push(i);
          g.sfx('clack');
          if (open.length === 2) {
            const [a, b] = open;
            if (deal[a] === deal[b]) {
              done.push(a, b);
              open = [];
              g.sfx('coin');
              if (done.length === 6) g.win();
            } else g.after(750, () => { up[a] = up[b] = false; open = []; mark(); });
          }
          mark();
        };
        mark();
        g.key = e => {
          if (isKey(e, 'ArrowLeft')) sel = (sel + 5) % 6;
          else if (isKey(e, 'ArrowRight', 'PageDown')) sel = (sel + 1) % 6;
          else if (isKey(e, 'ArrowUp', 'ArrowDown')) sel = (sel + 3) % 6;
          else if (isKey(e, 'PageUp')) sel = (sel + 5) % 6;
          else if (isKey(e, ...GO)) flip(sel);
          mark();
        };
      },
    },
  };
  function startGame(from, to, forced) {
    stopGame();
    const ok = Object.keys(GAMES).filter(k => !GAMES[k].ok || GAMES[k].ok(from, to));
    let kind = GAMES[forced] ? forced : null;
    for (let i = 0; !kind && i < 12; i++) { const k = draw('games', Object.keys(GAMES)); if (ok.includes(k)) kind = k; }
    kind = kind || pick(ok);
    const [title, hint] = T.games[kind];
    const root = deck.appendChild(make('div', { className: 'game' }));
    const board = root.appendChild(make('div', { className: 'game-board' }));
    const statusEl = make('em');
    root.appendChild(make('div', { className: 'game-hud' }, make('b', { textContent: title }), make('span', { textContent: hint }), statusEl, make('i', { textContent: T.games.skip })));
    const cleanup = [];
    const g = game = {
      kind, from, to, fromStep: step, root, over: false, key: null, cleanup, seamless: !!GAMES[kind].seamless,
      t0: performance.now(), perfects: 0, misses: 0,
      add: el => board.appendChild(el),
      // a w x h window onto slide k, whose top-left corner shows the point (x, y) of that slide
      view(k, st, x, y, w, h) {
        const v = make('div', { className: 'g-view' }), c = cloneSlide(k, st);
        v.style.width = w + 'px';
        v.style.height = h + 'px';
        c.style.transform = `translate(${-x}px, ${-y}px)`;
        v.appendChild(c);
        return v;
      },
      listen(target, type, fn) { target.addEventListener(type, fn); cleanup.push(() => target.removeEventListener(type, fn)); },
      after(ms, fn) { const id = setTimeout(fn, ms); cleanup.push(() => clearTimeout(id)); return id; },
      loop(fn) {
        let id = 0, last = performance.now();
        const tick = now => { fn(Math.min(0.05, (now - last) / 1000)); last = now; id = requestAnimationFrame(tick); };
        id = requestAnimationFrame(tick);
        cleanup.push(() => cancelAnimationFrame(id));
      },
      point(e) { const r = deck.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; },
      sfx(name, arg) { if (fxSound && SOUNDS[name]) SOUNDS[name](arg); },
      note(f, dur) { if (fxSound) voice({ type: 'triangle', f, gain: 0.16, dur: dur || 180 }); },
      play(o) { if (fxSound) voice(o); },
      tick() { if (fxSound) voice({ type: 'noise', filter: 'bandpass', ff: 3200, q: 10, gain: 0.14, dur: 14 }); },
      status(text) { statusEl.textContent = text; },
      // juice: a short shake of the board, and a puff of dust at (x, y)
      shake(px) {
        board.animate(Array.from({ length: 6 }, (_, i) => ({ transform: i === 5 ? 'translate(0px, 0px)' : `translate(${rnd(-px, px).toFixed(1)}px, ${rnd(-px, px).toFixed(1)}px)` })),
                      { duration: 220, easing: 'linear' });
      },
      dust(x, y, n) {
        for (let i = 0; i < (n || 8); i++) {
          const d = board.appendChild(make('div', { className: 'g-dust' })), a = rnd(Math.PI, 2 * Math.PI), r = rnd(30, 90);
          d.style.left = x + 'px';
          d.style.top = y + 'px';
          d.animate([{ transform: 'translate(0px, 0px) scale(.4)', opacity: 0.9 },
                     { transform: `translate(${(Math.cos(a) * r).toFixed(0)}px, ${(Math.sin(a) * r * 0.5).toFixed(0)}px) scale(1.3)`, opacity: 0 }],
                    { duration: rnd(350, 600), easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' }).finished.then(() => d.remove(), () => {});
        }
      },
      say(text, cls) {
        if (text.indexOf(T.games.perfect) === 0) g.perfects++;
        else if ([T.games.miss, T.games.early, T.games.late, T.games.ouch].includes(text)) g.misses++;
        const el = root.appendChild(make('div', { className: 'g-say' + (cls ? ' ' + cls : ''), textContent: text }));
        el.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.12)', opacity: 1, offset: 0.25 },
                    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }],
                   { duration: 800, easing: 'ease-out', fill: 'forwards' });
        g.after(820, () => el.remove());
      },
      win() {
        if (g.over) return;
        g.over = true;
        g.sfx('fanfare');
        g.say(T.games.win, 'win');
        g.after(800, () => endGame(true));
      },
    };
    GAMES[kind].play(g);
    return kind;
  }
  function stopGame() {
    if (!game) return;
    game.over = true;
    game.cleanup.forEach(f => f());
    game.root.remove();
    game = null;
  }
  function endGame(advance) {   // Escape, or a win: on to the next slide with a sober transition
    const g = game;
    if (!g) return;
    stopGame();
    if (advance) {
      rwPending = { kind: g.kind, ms: performance.now() - g.t0, perfects: g.perfects, misses: g.misses, skipped: !!g.skipped };
      if (g.seamless && !g.skipped) fxSkip = true;   // the game already ends on the next slide: no transition on top
      else fxForce = pick(['pro:zoom', 'pro:fade', 'pro:circle', 'pro:push']);
      go(g.to, 0);
    }
  }

  /* ---- rewards (X): points, combos, levels, cards and trophies for moving through the deck ----
     Off until X; Shift+X starts the progress over. Kept per file in this browser; audience window
     only; never in print. Each part borrows from a game that is good at it:
       tally      Balatro -- every bonus on a line of its own, pitch rising, then the red multiplier,
                  then the total rolling into the score; the shake grows with the number
       words      Candy Crush -- the combo is named, in escalating words
       cards      a variable-ratio drop (a pity timer makes it surer the longer it has been) with a
                  roulette-style rarity reveal: the anticipation, and the near miss, are the reward
       fever      Peggle -- the end of a chapter, and of the deck, to the Ode to Joy
       XP bar     always visibly nearer the next level
     Going forward one slide scores; a build scores a little; going back breaks the combo; a jump
     scores nothing. In games mode the game's result joins the tally. */
  const RW_KEY = 'deck.rw:' + location.pathname;
  const RARITY = ['common', 'rare', 'epic', 'legendary'], RARITY_P = [0.6, 0.27, 0.1, 0.03];
  const ACH = ['first', 'combo5', 'combo10', 'back', 'crit', 'rare', 'epic', 'legendary', 'chapter', 'half', 'end', 'speed', 'gamer', 'perfect', 'collector'];
  const rw = { on: false, score: 0, xp: 0, level: 1, combo: 0, best: 0, dry: 0, wins: 0, cards: {}, ach: {}, seen: {} };
  try { Object.assign(rw, JSON.parse(localStorage.getItem(RW_KEY) || '{}')); } catch (_) { /* no storage */ }
  rw.combo = 0;   // a combo does not outlive the page
  const rwSave = () => { try { localStorage.setItem(RW_KEY, JSON.stringify(rw)); } catch (_) { /* no storage */ } };
  // XP from level lv to lv + 1. XP counts the bonuses before any multiplier (the score takes those), so the levels
  // come at a steady pace -- the first after five or six slides, then one every seven or eight
  const xpFor = lv => 600 + 250 * lv;
  const fmt = n => Math.round(n).toLocaleString(deck.dataset.ui || document.documentElement.lang || 'en');
  const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const chapterStart = new Set();   // where a chapter begins: a data-section change, or a slide the agenda links to
  slides.forEach((s, k) => { if (k && section[k] && section[k] !== section[k - 1]) chapterStart.add(k); });
  deck.querySelectorAll('ol.agenda a[href^="#"]').forEach(a => { const k = lookup(a.getAttribute('href')); if (k > 1) chapterStart.add(k); });
  let rwPending = null, rwHud = null, rwLayer = null, rwQueue = [], rwBusy = false, rwTimes = [], shownScore = rw.score, achQueue = [], achBusy = false;

  const rwNote = (f, at, o) => { if (fxSound) setTimeout(() => voice(Object.assign({ type: 'triangle', f, gain: 0.14, dur: 160 }, o)), at || 0); };
  const rwSfx = (name, at, arg) => { if (fxSound && SOUNDS[name]) setTimeout(() => SOUNDS[name](arg), at || 0); };
  const SCALE = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];   // pentatonic, rising: one step per tally line
  function odeToJoy(at, half) {   // Beethoven (public domain), as in Peggle's Extreme Fever
    const E = 330, F = 349, G = 392, D = 294, C = 262, q = 220;
    const tune = [[E, 1], [E, 1], [F, 1], [G, 1], [G, 1], [F, 1], [E, 1], [D, 1], [C, 1], [C, 1], [D, 1], [E, 1], [E, 1.5], [D, 0.5], [D, 2]];
    let t = at || 0;
    (half ? tune.slice(0, 8).concat([[C, 2]]) : tune).forEach(([f, b]) => {
      rwNote(f * 2, t, { type: 'square', gain: 0.06, dur: q * b * 0.95 });
      rwNote(f, t, { type: 'triangle', gain: 0.1, dur: q * b });
      t += q * b;
    });
    for (let b = 0; b * q < t - (at || 0); b += 4) rwNote(b % 8 ? 98 : 131, (at || 0) + b * q, { type: 'triangle', gain: 0.13, dur: q * 4 });
  }

  /* the HUD, top left of the screen: level, XP bar, score, combo, cards */
  function rwHudDraw(bump) {
    if (PRESENTER) return;
    if (!rwHud) {
      rwHud = document.body.appendChild(make('div', { id: 'rw-hud' }, make('b', { className: 'lv' }), make('div', { className: 'xp' }, make('i')),
        make('span', { className: 'score', textContent: fmt(shownScore) }), make('span', { className: 'combo' }), make('span', { className: 'cards' }, make('i'), make('span'))));
    }
    rwHud.hidden = !rw.on;
    rwHud.querySelector('.lv').textContent = rw.level;
    rwHud.querySelector('.xp i').style.transform = `scaleX(${Math.min(1, rw.xp / xpFor(rw.level)).toFixed(3)})`;
    rwHud.querySelector('.combo').textContent = rw.combo > 1 ? '×' + Math.min(10, rw.combo) : '';
    rwHud.querySelector('.cards span').textContent = Object.keys(rw.cards).length;
    if (bump) rwHud.querySelector(bump).animate([{ transform: 'scale(1.6)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.3,1.6,.5,1)' });
  }
  function rollScore(to, kick) {   // the score counts up to its new value, the pill shaking with the size of the jump
    const el = rwHud.querySelector('.score'), from = shownScore, t0 = performance.now(), dur = Math.min(900, 300 + Math.log10(1 + to - from) * 160);
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur);
      shownScore = from + (to - from) * (1 - Math.pow(1 - k, 3));
      el.textContent = fmt(shownScore);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const px = Math.min(9, Math.log10(1 + kick) * 2);
    rwHud.animate(Array.from({ length: 7 }, (_, i) => ({ transform: i === 6 ? 'translate(0px,0px)' : `translate(${rnd(-px, px).toFixed(1)}px, ${rnd(-px, px).toFixed(1)}px)` })), { duration: 260 });
  }
  const layer = () => (rwLayer && rwLayer.isConnected ? rwLayer : (rwLayer = deck.appendChild(make('div', { className: 'rw-layer' }))));
  // where the HUD's card counter is, in the deck's own 1280 x 720 coordinates
  function hudPoint() {
    const r = rwHud.querySelector('.cards').getBoundingClientRect(), d = deck.getBoundingClientRect();
    return [(r.left + r.width / 2 - d.left) / d.width * W, (r.top + r.height / 2 - d.top) / d.height * H];
  }
  const pop = (el, delay, big) => el.animate([{ opacity: 0, transform: `translateX(40px) scale(${big ? 0.4 : 0.8})` }, { opacity: 1, transform: `translateX(0px) scale(${big ? 1.25 : 1.08})`, offset: 0.6 },
                                              { opacity: 1, transform: 'translateX(0px) scale(1)' }], { duration: big ? 320 : 220, delay, fill: 'both', easing: 'ease-out' });

  /* the tally: each bonus, then the multiplier, then the total (Balatro) */
  function tally(lines, mult, crit) {
    const box = layer().appendChild(make('div', { className: 'rw-tally' }));
    let at = 0, base = 0;
    lines.forEach(([text, pts], i) => {
      base += pts;
      pop(box.appendChild(make('div', { className: 'row' }, make('span', { textContent: text }), make('b', { textContent: '+' + fmt(pts) }))), at);
      rwNote(SCALE[Math.min(i, SCALE.length - 1)], at);
      at += 110;
    });
    const m = mult * (crit ? 3 : 1), total = Math.round(base * m);
    if (m > 1) {
      pop(box.appendChild(make('div', { className: 'row mult' + (crit ? ' crit' : '') }, make('span', { textContent: crit ? T.rw.crit : T.rw.combo }), make('b', { textContent: '×' + m }))), at, crit);
      rwNote(SCALE[Math.min(lines.length + 1, SCALE.length - 1)], at, { type: 'sawtooth', gain: 0.08 });
      if (crit) {   // the bass drops, the screen flashes
        rwSfx('boom', at);
        const f = layer().appendChild(make('div', { className: 'rw-flash' }));
        f.animate([{ opacity: 0 }, { opacity: 0.7 }, { opacity: 0 }], { duration: 260, delay: at, fill: 'both' }).finished.then(() => f.remove(), () => {});
      }
      at += crit ? 220 : 150;
    }
    pop(box.appendChild(make('div', { className: 'row total' }, make('span', { textContent: '=' }), make('b', { textContent: fmt(total) }))), at, true);
    rwSfx('coin', at);
    box.animate([{ opacity: 1, transform: 'translateY(0px)' }, { opacity: 0, transform: 'translateY(-24px)' }], { duration: 380, delay: at + 1100, fill: 'forwards' })
      .finished.then(() => box.remove(), () => {});
    return { total, at, base };
  }
  function bigWord(text, at, cls) {   // the combo's name, or COMBO BREAKER
    const el = layer().appendChild(make('div', { className: 'rw-word' + (cls ? ' ' + cls : ''), textContent: text }));
    const tilt = rnd(-6, 6), tf = (s, y) => `translate(-50%, ${y}px) rotate(${tilt}deg) scale(${s})`;
    el.animate([{ transform: tf(0.2, 30), opacity: 0 }, { transform: tf(1.2, 0), opacity: 1, offset: 0.18 }, { transform: tf(1, 0), opacity: 1, offset: 0.3 },
                { transform: tf(1.04, -6), opacity: 1, offset: 0.75 }, { transform: tf(1.3, -40), opacity: 0 }], { duration: 1300, delay: at, fill: 'both', easing: 'ease-out' })
      .finished.then(() => el.remove(), () => {});
  }

  /* ceremonies (level up, a card, a fever) play one after another, never on top of each other */
  function ceremony(fn) {
    if (rwQueue.length > 2) return;   // do not pile up behind a speaker in a hurry
    rwQueue.push(fn);
    if (!rwBusy) nextCeremony();
  }
  function nextCeremony() {
    const fn = rwQueue.shift();
    if (!fn) { rwBusy = false; return; }
    rwBusy = true;
    const els = [];
    const c = { add: el => { els.push(el); return layer().appendChild(el); } };
    setTimeout(() => { els.forEach(e => e.remove()); nextCeremony(); }, fn(c));
  }
  function shower(c, x, y, n, rain) {   // confetti: a burst from (x, y), or a rain from the top
    for (let i = 0; i < n; i++) {
      const el = c.add(make('div', { className: 'fx-bit fx-c' + (i % 6) })), fl = rnd(900, 2200), r = rnd(-700, 700);
      el.style.left = (rain ? rnd(0, W) : x) + 'px';
      el.style.top = (rain ? -30 : y) + 'px';
      if (rain) el.animate([{ transform: 'translate(0px,0px) rotate(0deg) rotateX(0deg)' }, { transform: `translate(${rnd(-90, 90)}px, ${H + 80}px) rotate(${r}deg) rotateX(${fl}deg)` }],
                           { duration: rnd(1500, 2600), delay: rnd(0, 1400), fill: 'both', easing: 'linear' });
      else {
        const a = rnd(-Math.PI, 0), v = rnd(250, 700), dx = Math.cos(a) * v, up = -Math.sin(a) * v;
        el.animate([{ transform: 'translate(0px,0px) rotate(0deg) rotateX(0deg)', easing: 'cubic-bezier(.2,.7,.4,1)' },
                    { transform: `translate(${dx * 0.6}px, ${-up}px) rotate(${r * 0.4}deg) rotateX(${fl * 0.4}deg)`, offset: 0.35, easing: 'cubic-bezier(.5,0,.9,.6)' },
                    { transform: `translate(${dx}px, ${H - y + 60}px) rotate(${r}deg) rotateX(${fl}deg)` }], { duration: rnd(1300, 1900), fill: 'both' });
      }
    }
  }
  const rays = (c, parent, dur) => {
    const r = parent.appendChild(make('div', { className: 'rw-rays' }));
    r.animate([{ transform: 'rotate(0deg) scale(.6)', opacity: 0 }, { transform: 'rotate(40deg) scale(1)', opacity: 1, offset: 0.2 }, { transform: 'rotate(140deg) scale(1.05)', opacity: 1, offset: 0.85 },
               { transform: 'rotate(170deg) scale(1.1)', opacity: 0 }], { duration: dur, fill: 'both' });
    return r;
  };
  function levelUp(lv) {
    ceremony(c => {
      const box = c.add(make('div', { className: 'rw-level' }));
      rays(c, box, 2000);
      box.append(make('small', { textContent: T.rw.levelUp }));
      const num = box.appendChild(make('b', { textContent: lv - 1 }));
      box.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 2000, fill: 'both' });
      num.animate([{ transform: 'scale(.3)' }, { transform: 'scale(1)', offset: 0.3 }], { duration: 400, fill: 'both', easing: 'cubic-bezier(.3,1.6,.5,1)' });
      setTimeout(() => {   // the number turns over to the new level, with a punch
        num.textContent = lv;
        num.animate([{ transform: 'scale(1.6)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 380, easing: 'cubic-bezier(.3,1.6,.5,1)' });
        shower(c, W / 2, H / 2, 60);
        rwSfx('fanfare');
        rwHudDraw('.lv');
      }, 520);
      rwSfx('jingle', 60);
      return 2050;
    });
  }
  function revealCard(k, rarity, upgrade) {   // the card is the slide just left; its rarity lands like a roulette
    ceremony(c => {
      const R = RARITY.indexOf(rarity), colors = RARITY.map((_, i) => cssVar('--rw-' + (i + 1)));
      const box = c.add(make('div', { className: 'rw-reveal' }));
      if (R === 3) rays(c, box, 3300);
      const view = make('div', { className: 'rw-view' }, cloneSlide(k, nBuilds[k]));
      const back = make('div', { className: 'back' }, make('span', { textContent: '?' }));
      const front = make('div', { className: 'front r-' + rarity }, view, make('div', { className: 'foil' }),
                         make('div', { className: 'name', textContent: (titleOf(k) || label[k]) }), make('div', { className: 'tier', textContent: T.rw.rarity[R] }));
      const inner = make('div', { className: 'in' }, back, front), card = box.appendChild(make('div', { className: 'rw-card' }, inner));
      box.appendChild(make('div', { className: 'rw-caption', textContent: upgrade ? T.rw.upgrade : T.rw.newCard }));
      card.animate([{ transform: 'scale(0) rotate(-12deg)' }, { transform: 'scale(1.1) rotate(3deg)', offset: 0.7 }, { transform: 'scale(1) rotate(0deg)' }],
                   { duration: 300, easing: 'ease-out', fill: 'both' });
      // anticipation: the glow runs through the rarities, slowing, and lands (sometimes just past the gold one)
      const seq = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3];
      while (seq[seq.length - 1] !== R) seq.push((seq[seq.length - 1] + 1) % 4);
      if (R < 3 && Math.random() < 0.5) { seq.splice(seq.length - 1, 0, 3); }
      let t = 280;
      seq.forEach((r, i) => {
        const col = colors[r], last = i === seq.length - 1;
        setTimeout(() => {
          back.style.boxShadow = `0 0 ${30 + i * 3}px ${6 + i}px ${col}`;
          back.style.borderColor = col;
          rwNote(440 * Math.pow(2, i / 12), 0, { type: 'square', gain: 0.05, dur: 40 });
        }, t);
        t += last ? 0 : 35 + i * i * 2.2;   // decelerating
      });
      card.animate(Array.from({ length: 12 }, (_, i) => ({ transform: `translate(${(rnd(-1, 1) * i * 0.6).toFixed(1)}px, ${(rnd(-1, 1) * i * 0.4).toFixed(1)}px) rotate(${(rnd(-1, 1) * i * 0.25).toFixed(2)}deg)` })),
                   { duration: t - 280, delay: 300, composite: 'add' });
      const flip = t + 120;
      setTimeout(() => {   // the flip, a flash in the rarity's colour, a sound by rarity
        inner.style.transform = 'rotateY(180deg)';
        const f = box.appendChild(make('div', { className: 'rw-burst' }));
        f.style.background = `radial-gradient(circle, ${colors[R]} 0, transparent 60%)`;
        f.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(2.4)', opacity: 0 }], { duration: 600, easing: 'ease-out', fill: 'forwards' });
        rwSfx(['pop', 'coin', 'jingle', 'fanfare'][R]);
        if (R === 3) { rwSfx('boom', 0); shower(c, W / 2, H / 2, 90); }
        if (R === 2) shower(c, W / 2, H / 2, 40);
      }, flip);
      const hold = flip + (R === 3 ? 1500 : R === 2 ? 1100 : 800);
      setTimeout(() => {   // into the collection, top left
        const [hx, hy] = hudPoint(), r = card.getBoundingClientRect(), d = deck.getBoundingClientRect();
        const cx = (r.left + r.width / 2 - d.left) / d.width * W, cy = (r.top + r.height / 2 - d.top) / d.height * H;
        card.animate([{ transform: 'translate(0px,0px) scale(1)', opacity: 1 }, { transform: `translate(${hx - cx}px, ${hy - cy}px) scale(.06)`, opacity: 0.6 }],
                     { duration: 420, easing: 'cubic-bezier(.6,0,.4,1)', fill: 'forwards' });
        box.animate([{ background: 'rgba(20,17,13,.55)' }, { background: 'rgba(20,17,13,0)' }], { duration: 420, fill: 'forwards' });
        setTimeout(() => { rwHudDraw('.cards'); rwNote(1319, 0, { dur: 120 }); }, 420);
      }, hold);
      return hold + 480;
    });
  }
  function fever(final) {   // the end of a chapter -- or of the deck: rainbow, confetti, the Ode to Joy, a bonus counting up
    ceremony(c => {
      const dur = final ? 4600 : 2800, bonus = (final ? 5000 : 1000) * Math.max(1, Math.min(10, rw.combo));
      const box = c.add(make('div', { className: 'rw-fever' + (final ? ' final' : '') }, make('div', { className: 'rainbow' })));
      const title = box.appendChild(make('b', { textContent: final ? T.rw.extreme : T.rw.chapter }));
      const count = box.appendChild(make('span', { className: 'bonus', textContent: '+0' }));
      box.animate([{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], { duration: dur, fill: 'both' });
      box.firstChild.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 3000, iterations: 2 });
      title.animate([{ transform: 'scale(.2)', letterSpacing: '-.1em' }, { transform: 'scale(1.1)', letterSpacing: '.04em', offset: 0.5 }, { transform: 'scale(1)', letterSpacing: '.02em' }],
                    { duration: 600, easing: 'ease-out', fill: 'both' });
      const t0 = performance.now() + 500;
      const tick = now => {   // the bonus counts up, clicking as it goes
        const k = Math.max(0, Math.min(1, (now - t0) / 1200));
        count.textContent = '+' + fmt(bonus * (1 - Math.pow(1 - k, 2)));
        if (k < 1 && box.isConnected) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      for (let i = 0; i < 12; i++) rwNote(600 + i * 60, 500 + i * 100, { type: 'square', gain: 0.03, dur: 40 });
      shower(c, 0, 0, final ? 160 : 90, true);
      odeToJoy(150, !final);
      if (final) {   // and the whole run, summed up
        const s = box.appendChild(make('div', { className: 'stats' }));
        [[T.rw.stats[0], fmt(rw.score + bonus)], [T.rw.stats[1], rw.level], [T.rw.stats[2], Object.keys(rw.cards).length + ' / ' + N],
         [T.rw.stats[3], Object.keys(rw.ach).length + ' / ' + ACH.length], [T.rw.stats[4], '×' + rw.best]]
          .forEach(([a, b], i) => { const x = s.appendChild(make('span', { textContent: a })), y = s.appendChild(make('b', { textContent: b })); pop(x, 1500 + i * 180); pop(y, 1500 + i * 180); });
      }
      setTimeout(() => { rw.score += bonus; rw.xp += final ? 2000 : 500; rollScore(rw.score, bonus); rwHudDraw(); rwSave(); gainLevels(); }, 1800);
      return dur;
    });
  }
  function unlock(id) {   // a trophy, once: it slides in at the bottom right
    if (rw.ach[id] || !T.rw.ach[id]) return;
    rw.ach[id] = 1;
    achQueue.push(id);
    if (!achBusy) nextAch();
  }
  function nextAch() {
    const id = achQueue.shift();
    if (!id) { achBusy = false; return; }
    achBusy = true;
    const [name, what] = T.rw.ach[id];
    const el = layer().appendChild(make('div', { className: 'rw-ach' }, make('div', { className: 'cup', textContent: '★' }),
      make('div', {}, make('small', { textContent: T.rw.unlocked }), make('b', { textContent: name }), make('span', { textContent: what }))));
    el.animate([{ transform: 'translateX(420px)', opacity: 0 }, { transform: 'translateX(-12px)', opacity: 1, offset: 0.1 }, { transform: 'translateX(0px)', opacity: 1, offset: 0.14 },
                { transform: 'translateX(0px)', opacity: 1, offset: 0.88 }, { transform: 'translateX(420px)', opacity: 0 }], { duration: 2800, easing: 'ease-out', fill: 'both' })
      .finished.then(() => el.remove(), () => {});
    el.querySelector('.cup').animate([{ transform: 'rotate(-30deg) scale(.4)' }, { transform: 'rotate(10deg) scale(1.2)', offset: 0.6 }, { transform: 'rotate(0deg) scale(1)' }],
                                     { duration: 500, delay: 250, fill: 'both' });
    rwNote(784, 250, { dur: 120 });
    rwNote(1175, 380, { dur: 260 });
    setTimeout(nextAch, 900);
  }
  function gainLevels() {
    while (rw.xp >= xpFor(rw.level)) { rw.xp -= xpFor(rw.level); rw.level++; levelUp(rw.level); }
    rwHudDraw();
  }
  function rollRarity() {
    let x = Math.random();
    for (let i = RARITY.length - 1; i > 0; i--) { if (x < RARITY_P[i]) return RARITY[i]; x -= RARITY_P[i]; }
    return RARITY[0];
  }

  /* the hook: render() calls this on every change of slide or build */
  function rewardMove(from, fromStep, to, toStep) {
    if (!rw.on || PRESENTER || dev || from < 0) return;
    if (from === to) {   // a build: a little something
      if (toStep <= fromStep) return;
      const pts = 10 * Math.max(1, Math.min(10, rw.combo));
      rw.score += pts;
      rw.xp += 10;
      rollScore(rw.score, pts);
      rwNote(1568, 0, { dur: 60, gain: 0.08 });
      gainLevels();
      rwSave();
      return;
    }
    if (to < from) {   // going back breaks the combo
      if (rw.combo >= 3) { bigWord(T.rw.breaker, 0, 'breaker'); rwSfx('sad'); }
      rw.combo = 0;
      unlock('back');
      rwHudDraw();
      rwSave();
      return;
    }
    if (to !== from + 1) return;   // a jump: nothing
    const now = performance.now(), pend = rwPending;
    rwPending = null;
    rw.combo++;
    rw.best = Math.max(rw.best, rw.combo);
    const lines = [[T.rw.slide, 100]];
    if (!rw.seen[from]) { rw.seen[from] = 1; lines.push([T.rw.fresh, 50]); }
    if (pend && !pend.skipped) {
      rw.wins++;
      lines.push([T.rw.won + ' · ' + T.games[pend.kind][0], 250]);
      if (pend.perfects) lines.push([T.games.perfect + ' ×' + pend.perfects, 80 * pend.perfects]);
      if (!pend.misses) lines.push([T.rw.clean, 120]);
      if (pend.ms < 5000) lines.push([T.rw.fast, 150]);
    }
    const chapter = chapterStart.has(to);
    if (chapter) lines.push([T.rw.chapterLine, 500]);
    const crit = Math.random() < 1 / 12, mult = Math.min(10, rw.combo);
    const { total, at, base } = tally(lines, mult, crit);
    rw.score += total;
    rw.xp += base;
    setTimeout(() => { rollScore(rw.score, total); rwHudDraw('.combo'); }, at);
    if (T.rw.words[rw.combo]) { bigWord(T.rw.words[rw.combo], at + 120); rwSfx('jingle', at + 120); }
    setTimeout(gainLevels, at + 200);
    // a card, now and then: surer the longer it has been since the last one
    if (Math.random() < 0.1 + 0.05 * rw.dry) {   // about one slide in four or five
      rw.dry = 0;
      const rarity = rollRarity(), had = rw.cards[from];
      if (had === undefined || RARITY.indexOf(rarity) > RARITY.indexOf(had)) rw.cards[from] = rarity;
      setTimeout(() => revealCard(from, rarity, had !== undefined && RARITY.indexOf(rarity) > RARITY.indexOf(had)), at + 300);
      if (rarity !== 'common') unlock(rarity);
    } else rw.dry++;
    if (to === lastMain) setTimeout(() => fever(true), at + 300);
    else if (chapter) setTimeout(() => fever(false), at + 300);
    rwTimes = rwTimes.filter(t => now - t < 4000).concat([now]);
    unlock('first');
    if (rw.combo >= 5) unlock('combo5');
    if (rw.combo >= 10) unlock('combo10');
    if (crit) unlock('crit');
    if (chapter) unlock('chapter');
    if (mainNo[to] >= M / 2) unlock('half');
    if (to === lastMain) unlock('end');
    if (rwTimes.length >= 3) unlock('speed');
    if (rw.wins >= 5) unlock('gamer');
    if (pend && !pend.skipped && pend.perfects && !pend.misses) unlock('perfect');
    if (Object.keys(rw.cards).length >= 20) unlock('collector');
    rwHudDraw();
    rwSave();
  }
  function setRewards(on) {
    rw.on = on;
    rw.combo = 0;
    rwSave();
    rwHudDraw();
    toast(T.rw.toast[on ? 1 : 0]);
  }
  function resetRewards() {
    Object.assign(rw, { score: 0, xp: 0, level: 1, combo: 0, best: 0, dry: 0, wins: 0, cards: {}, ach: {}, seen: {} });
    shownScore = 0;
    if (rwHud) rwHud.querySelector('.score').textContent = '0';
    rwSave();
    rwHudDraw();
    toast(T.rw.reset);
  }

  /* ---- navigation ------------------------------------------------------------
     State is (slide, build). With a speaker view open both windows hold it and
     the newest change wins; a freshly loaded audience window counts as the
     newest, so reloading the deck pulls the speaker view along. */
  let cur = 0, step = 0, stamp = PRESENTER ? 0 : Date.now(), peer = null;
  let sorter = null, sorterOpen = false, sel = 0;
  let pv = null, notesFor = -1, resetTimer = () => {};
  let dev = false, devEl = null, devProblems = [];
  let shown = -1, shownStep = 0;   // the slide on screen, and its build, for the transition that leaves it

  function go(k, s, remote) {
    stopGame();
    cur = Math.max(0, Math.min(N - 1, k));
    step = Math.max(0, Math.min(nBuilds[cur], s | 0));
    render();
    if (!remote) { stamp = Date.now(); send({ deck: 'state', k: cur, s: step, t: stamp }); }
  }
  const next = () => {
    if (game) return;
    if (step < nBuilds[cur]) go(cur, step + 1);
    else if (cur < N - 1) {
      if (fxMode === 'games' && !PRESENTER && !dev && !sorterOpen) startGame(cur, cur + 1);
      else go(cur + 1, 0);
    }
  };
  const prev = () => step > 0 ? go(cur, step - 1) : cur > 0 && go(cur - 1, nBuilds[cur - 1]);

  function render() {
    try { history.replaceState(null, '', '#' + hashOf(cur)); } catch (_) { /* sandboxed page */ }
    if (sorterOpen) markSorter();
    if (PRESENTER) return renderPresenter();
    const from = shown;
    if (fxRun && from !== cur) fxRun.finish();   // a build step lets a running transition play on
    slides.forEach((s, k) => s.classList.toggle('active', k === cur));
    setBuild(slides[cur], step);
    const pin = from >= 0 && from !== cur ? (slides[cur > from ? cur : from].dataset.fx || '') : '';
    const pinOk = pin !== '' && pin !== 'none' && SETS[pin.split(':')[0]] && SETS[pin.split(':')[0]].fx[pin.split(':')[1]];
    if (from >= 0 && from !== cur && (fxMode !== 'off' || pinOk) && pin !== 'none' && !dev && !document.hidden && !fxSkip) {
      if (pinOk && !fxForce) fxForce = pin;
      fxRun = playTransition(from, shownStep, cur, step, cur > from ? 1 : -1);
    }
    rewardMove(from, shownStep, cur, step);
    fxSkip = false;
    shown = cur;
    shownStep = step;
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
    else if (d.deck === 'fx' && FX_MODES.includes(d.m)) setFx(d.m, true);
    else if (d.deck === 'sfx') setSound(!!d.on, true);
  });

  /* ---- speaker view: S opens this same file with ?presenter ------------------ */
  function openPresenter() {
    const url = location.href.split('#')[0].split('?')[0] + '?presenter#' + hashOf(cur);
    peer = window.open(url, 'deck-presenter', 'popup,width=1440,height=860') || peer;
  }
  function buildPresenter() {
    document.body.classList.add('presenter');
    document.title = 'Presenter — ' + document.title;
    const timer = make('button', { className: 'timer', title: T.reset, textContent: '00:00' });
    const wall = make('span', { className: 'wall' });
    pv = make('div', { id: 'pv' },
      make('section', { className: 'now' },
        make('div', { className: 'bar' }, make('b', { textContent: T.now }), make('span', { className: 'pos' })),
        make('div', { className: 'stage' })),
      make('section', {},
        make('div', { className: 'bar' }, make('b', { textContent: T.next }), make('span', { className: 'npos' })),
        make('div', { className: 'stage' }),
        make('div', { className: 'clock' }, timer, wall),
        make('div', { className: 'notes' })));
    document.body.appendChild(pv);
    const two = n => String(n).padStart(2, '0');
    let t0 = Date.now();
    const tick = () => {
      const e = Math.floor((Date.now() - t0) / 1000), d = new Date();
      timer.textContent = (e >= 3600 ? Math.floor(e / 3600) + ':' : '') + two(Math.floor(e / 60) % 60) + ':' + two(e % 60);
      wall.textContent = two(d.getHours()) + ':' + two(d.getMinutes());
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
    sorter = make('div', { id: 'sorter' }, grid);
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
      if (s.classList.contains('include-error')) list.push({ k, kind: 'include', text: s.querySelector('h1').textContent });
      s.querySelectorAll('.katex-error').forEach(e => list.push({ k, kind: 'maths', text: (e.getAttribute('title') || e.textContent).slice(0, 90) }));
      // KaTeX only renders a delimiter it can pair, and an unbalanced brace keeps $...$
      // open: the source then stays on the slide as raw text, with no error at all
      const texts = document.createTreeWalker(s, NodeFilter.SHOW_TEXT);
      for (let node; (node = texts.nextNode());) {
        const host = node.parentElement, m = node.nodeValue.match(/\$|\\\(|\\\[/);
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
    if (on && fxRun) fxRun.finish();
    if (on) stopGame();
    dev = on;
    try { if (on) localStorage.setItem(DEV_KEY, '1'); else localStorage.removeItem(DEV_KEY); } catch (_) { /* no storage */ }
    document.body.classList.toggle('dev', on);
    if (devEl) devEl.hidden = !on;
    markOverflow();
    renderDev(true);
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
    if (game && key !== 'f' && key !== 'F') {   // a game has the keyboard; Escape skips it
      if (key === 'Escape') { game.skipped = true; endGame(true); }
      else if (game.key) game.key(e);
      e.preventDefault();
      return;
    }
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
    else if (key === 'm' || key === 'M') setSound(!fxSound);
    else if (key === 'x' && !PRESENTER) setRewards(!rw.on);
    else if (key === 'X' && !PRESENTER) resetRewards();
    else if ((key === 's' || key === 'S') && !PRESENTER) openPresenter();
    else if ((key === 'r' || key === 'R') && PRESENTER) resetTimer();
    else if ((key === 'd' || key === 'D') && !PRESENTER) setDev(!dev);
    else if (key === 't' || key === 'T') setFx(FX_MODES[(FX_MODES.indexOf(fxMode) + (key === 'T' ? FX_MODES.length - 1 : 1)) % FX_MODES.length]);
    else if ((key === 'n' || key === 'N') && !PRESENTER) setFxNames(!fxNames);
    else if (key === '?') toggleKeys(true);
    else if (key === 'f' || key === 'F') {
      document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    }
  });
  // click: right 2/3 forward, left 1/3 back -- not on a link, a button, a panel, or while authoring
  addEventListener('click', e => {
    if (PRESENTER || sorterOpen || dev || game || e.target.closest('a, button, #sorter, #dev, #keys, .game')) return;
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
  rwHudDraw();
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
  window.Deck = { go: target => { const k = lookup(target); if (k >= 0) go(k, 0); return k; }, next, prev, problems: scanProblems,
                  transition: () => fxRun && fxRun.name,
                  rewards: () => JSON.parse(JSON.stringify(rw)),
                  // Deck.play() lists the games; Deck.play('memory') plays that one towards the next slide
                  play(kind) {
                    if (!kind) return Object.keys(GAMES);
                    if (!GAMES[kind] || cur >= N - 1 || PRESENTER) return 'unknown game, or no next slide -- Deck.play() lists them';
                    return startGame(cur, cur + 1, kind);
                  },
                  // Deck.fx() lists every effect; Deck.fx('cartoon:weight') plays that one to the next slide (or back, on the last)
                  fx(name) {
                    const all = Object.keys(SETS).flatMap(s => Object.keys(SETS[s].fx).map(n => s + ':' + n));
                    if (!name) return all;
                    if (!all.includes(name)) return 'unknown effect -- Deck.fx() lists them';
                    if (fxMode === 'off') setFx('pro');
                    fxForce = name;
                    if (cur < N - 1) go(cur + 1, 0); else go(cur - 1, 0);
                    return name;
                  } };
})();
