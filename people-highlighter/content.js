(async () => {
  const detectorUrl = chrome.runtime.getURL('detector.js');
  const mod = await import(detectorUrl);
  const detector = await mod.createDetector({ mode: 'rtdetr' });

  function ensureOverlay(el) {
    if (el.__phCanvas) return el.__phCanvas;
    const rect = el.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    canvas.width = el.clientWidth || rect.width;
    canvas.height = el.clientHeight || rect.height;
    canvas.className = 'ph-overlay-canvas';

    const wrap = document.createElement('div');
    wrap.className = 'ph-overlay-wrap';
    el.parentElement.insertBefore(wrap, el);
    wrap.appendChild(el);
    wrap.appendChild(canvas);
    el.__phCanvas = canvas;
    return canvas;
  }

  function drawMasks(canvas, masks) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.globalAlpha = 0.35;
    for (const m of masks) {
      if (m.score < 0.5) continue;
      const { x, y, w, h, bitmap } = m;
      const id = ctx.createImageData(w, h);
      for (let i = 0; i < w*h; i++) {
        const a = bitmap[i];
        id.data[i*4+0] = 0;
        id.data[i*4+1] = 255;
        id.data[i*4+2] = 0;
        id.data[i*4+3] = a;
      }
      const off = new OffscreenCanvas(w,h);
      off.getContext('2d').putImageData(id,0,0);
      ctx.drawImage(off, x, y);
    }
    ctx.globalAlpha = 1.0;
  }

  async function processImage(img) {
    if (!window.__PH_ENABLED__) return;
    const canvas = ensureOverlay(img);
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    const masks = await detector.segment(img);
    drawMasks(canvas, masks);
  }

  async function processVideo(v) {
    if (!window.__PH_ENABLED__) return;
    const canvas = ensureOverlay(v);
    canvas.width = v.clientWidth;
    canvas.height = v.clientHeight;

    async function tick() {
      if (!window.__PH_ENABLED__) return;
      try {
        const masks = await detector.segment(v);
        drawMasks(canvas, masks);
      } catch (e) { /* ignore */ }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  document.querySelectorAll('img').forEach(img => img.complete ? processImage(img) : img.addEventListener('load', () => processImage(img)));
  document.querySelectorAll('video').forEach(v => v.addEventListener('play', () => processVideo(v), { once: true }));

  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      m.addedNodes.forEach(n => {
        if (n.tagName === 'IMG') processImage(n);
        if (n.tagName === 'VIDEO') n.addEventListener('play', () => processVideo(n), { once: true });
        if (n.querySelectorAll) {
          n.querySelectorAll('img').forEach(processImage);
          n.querySelectorAll('video').forEach(v => v.addEventListener('play', () => processVideo(v), { once: true }));
        }
      });
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
