/* beforeafter.js
  Simple, dependency-free before/after slider that supports images, GIFs (as <img>),
  and HTML5 <video>. If both sources are <video>, it will attempt to sync play/pause/time.
  Drop a .ba element into your HTML (see snippet below).
*/

(function(){
  function initBeforeAfter(root) {
    const container = root;
    const frame = container.querySelector('.frame');
    const beforeEl = container.querySelector('[data-ba-before]');
    const afterEl  = container.querySelector('[data-ba-after]');
    const handle = container.querySelector('.handle');
    const knob = container.querySelector('.knob');

    if (!frame || !beforeEl || !afterEl || !handle) return;

    // initial position (0..1)
    let pos = parseFloat(container.dataset.baInitial) || 0.5;
    pos = Math.max(0, Math.min(1, pos));
    let dragging = false;
    let syncLock = false;

    // Identify types
    function isVideo(el){
      return el && el.tagName && el.tagName.toLowerCase() === 'video';
    }
    function isImg(el){
      return el && el.tagName && el.tagName.toLowerCase() === 'img';
    }

    const beforeIsVideo = isVideo(beforeEl);
    const afterIsVideo  = isVideo(afterEl);
    const bothVideos = beforeIsVideo && afterIsVideo;

    // apply initial clip
    function applyPos(p){
      // clip right side of the 'after' element so only left portion shows
      const pct = Math.round(p*10000)/100; // 2 decimals
      // Use clip-path if available for smoother GPU clipping; fallback to width for compatibility
      if (CSS.supports && CSS.supports('clip-path', 'inset(0 50% 0 0)')) {
        afterEl.style.clipPath = `inset(0 ${100-pct}% 0 0)`;
      } else {
        // fallback: set width on container wrapper (works but may change layout)
        afterEl.style.width = `${pct}%`;
      }
      // move handle
      handle.style.left = `${pct}%`;
      knob.style.left = '50%';
      container.setAttribute('data-ba-pos', pct.toString());
    }

    applyPos(pos);

    function clientX(e){
      if (e.touches && e.touches[0]) return e.touches[0].clientX;
      return e.clientX;
    }

    function onPointerDown(e){
      e.preventDefault();
      dragging = true;
      container.classList.add('ba-dragging');
      onPointerMove(e);
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('touchmove', onPointerMove, {passive:false});
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchend', onPointerUp);
    }
    function onPointerMove(e){
      if (!dragging) return;
      if (e.cancelable) e.preventDefault();
      const rect = frame.getBoundingClientRect();
      const x = clientX(e);
      const p = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      pos = p;
      applyPos(pos);
    }
    function onPointerUp(){
      dragging = false;
      container.classList.remove('ba-dragging');
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchend', onPointerUp);
    }

    // click to jump
    frame.addEventListener('click', function(e){
      // avoid jump if user clicked the handle directly (handled by down)
      if (dragging) return;
      const rect = frame.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (clientX(e) - rect.left) / rect.width));
      pos = p;
      applyPos(pos);
    });

    // handle pointer targets
    handle.addEventListener('mousedown', onPointerDown);
    handle.addEventListener('touchstart', onPointerDown, {passive:false});

    // keyboard support
    container.tabIndex = container.tabIndex || 0;
    container.addEventListener('keydown', function(e){
      if (e.key === 'ArrowLeft') { pos = Math.max(0, pos - 0.02); applyPos(pos); }
      if (e.key === 'ArrowRight'){ pos = Math.min(1, pos + 0.02); applyPos(pos); }
    });

    // Sync videos if both are videos
    if (bothVideos) {
      const a = beforeEl, b = afterEl;
      function onPlay(e){
        if (syncLock) return;
        syncLock = true;
        try {
          if (e.target === a) { if (b.paused) b.play().catch(()=>{}); }
          else { if (a.paused) a.play().catch(()=>{}); }
        } finally { syncLock = false; }
      }
      function onPause(e){
        if (syncLock) return;
        syncLock = true;
        try {
          if (e.target === a) { if (!b.paused) b.pause(); }
          else { if (!a.paused) a.pause(); }
        } finally { syncLock = false; }
      }
      function onTimeUpdate(e){
        if (syncLock) return;
        const src = e.target;
        const tgt = src === a ? b : a;
        if (!tgt) return;
        const dt = Math.abs(tgt.currentTime - src.currentTime);
        if (dt > 0.05) {
          syncLock = true;
          try {
            tgt.currentTime = src.currentTime;
          } catch(err){}
          syncLock = false;
        }
      }
      a.addEventListener('play', onPlay);
      b.addEventListener('play', onPlay);
      a.addEventListener('pause', onPause);
      b.addEventListener('pause', onPause);
      a.addEventListener('timeupdate', onTimeUpdate);
      b.addEventListener('timeupdate', onTimeUpdate);
    }

    // If one or both are GIF <img>, give user a tip (no programmatic control)
    function isAnimatedGif(img){
      if (!isImg(img)) return false;
      const src = img.getAttribute('src')||'';
      return src.toLowerCase().endsWith('.gif');
    }
    if (isAnimatedGif(beforeEl) || isAnimatedGif(afterEl)) {
      // can't sync GIF playback; consider converting to webm/mp4 for better control.
      container.dataset.baGif = 'true';
    }
  }

  // Auto-init: any .ba element on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.ba').forEach(initBeforeAfter);
  });

  // Expose a manual init function (in case you render content later)
  window.initBeforeAfter = initBeforeAfter;
})();
