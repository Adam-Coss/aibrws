import * as ort from 'onnxruntime-web';

async function loadModel(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch model: ' + url);
  const buf = await res.arrayBuffer();
  return await ort.InferenceSession.create(buf, {
    executionProviders: ['webgpu', 'wasm'],
    graphOptimizationLevel: 'all'
  });
}

function iou(a, b) {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const ua = a.w * a.h + b.w * b.h - inter;
  return ua ? (inter / ua) : 0;
}
function nms(boxes, thr = 0.5) {
  boxes.sort((a,b)=>b.score-a.score);
  const picked = [];
  for (const b of boxes) {
    if (picked.every(p => iou(p,b) < thr)) picked.push(b);
  }
  return picked;
}

function toInputTensor(sourceEl, size) {
  const w = sourceEl.videoWidth || sourceEl.naturalWidth || sourceEl.width;
  const h = sourceEl.videoHeight || sourceEl.naturalHeight || sourceEl.height;
  const scale = Math.min(size / w, size / h);
  const nw = Math.round(w * scale), nh = Math.round(h * scale);
  const off = new OffscreenCanvas(size, size);
  const ctx = off.getContext('2d');
  ctx.clearRect(0,0,size,size);
  const dx = Math.floor((size - nw) / 2);
  const dy = Math.floor((size - nh) / 2);
  ctx.drawImage(sourceEl, 0, 0, w, h, dx, dy, nw, nh);
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = new Float32Array(1*3*size*size);
  for (let i = 0; i < size*size; i++) {
    const r = imageData.data[i*4+0] / 255;
    const g = imageData.data[i*4+1] / 255;
    const b = imageData.data[i*4+2] / 255;
    data[i] = r; data[i + size*size] = g; data[i + 2*size*size] = b;
  }
  return { tensor: new ort.Tensor('float32', data, [1,3,size,size]), w, h, scale, dx, dy, size };
}

function mapBox(b, ctx) {
  const { w, h, scale, dx, dy, size } = ctx;
  const cx = b[0]*size, cy = b[1]*size, bw = b[2]*size, bh = b[3]*size;
  const x = (cx - bw/2 - dx) / scale;
  const y = (cy - bh/2 - dy) / scale;
  return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)), w: Math.round(bw/scale), h: Math.round(bh/scale), score: b[4], class: 'person' };
}

async function createDetector({ mode = 'rtdetr' } = {}) {
  const base = location.origin;
  const detUrl = `${base}/assets/models/rtdetr_r50vd.onnx`; 
  const segUrl = `${base}/assets/models/u2net_human_seg.onnx`;

  const det = await loadModel(detUrl);
  const seg = await loadModel(segUrl);

  async function detect(sourceEl) {
    const { tensor, ...ctx } = toInputTensor(sourceEl, 640);
    const outputs = await det.run({ images: tensor });
    const key = Object.keys(outputs)[0];
    const out = outputs[key].data;
    const rows = out.length / 6;
    const boxes = [];
    for (let i = 0; i < rows; i++) {
      const off = i*6;
      const cls = out[off+5]|0;
      const score = out[off+4];
      if (cls !== 0 || score < 0.5) continue; // person only
      boxes.push(mapBox(out.slice(off, off+6), ctx));
    }
    return nms(boxes, 0.5);
  }

  async function segment(sourceEl) {
    const boxes = await detect(sourceEl);
    const masks = [];
    const vw = sourceEl.videoWidth || sourceEl.naturalWidth || sourceEl.width;
    const vh = sourceEl.videoHeight || sourceEl.naturalHeight || sourceEl.height;
    const tmp = new OffscreenCanvas(vw, vh);
    const tctx = tmp.getContext('2d');
    tctx.drawImage(sourceEl, 0, 0, vw, vh);
    for (const b of boxes) {
      const crop = new OffscreenCanvas(b.w, b.h);
      const cctx = crop.getContext('2d');
      cctx.drawImage(tmp, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
      const size = 320;
      const inp = new OffscreenCanvas(size, size);
      const ictx = inp.getContext('2d');
      ictx.drawImage(crop, 0, 0, b.w, b.h, 0, 0, size, size);
      const id = ictx.getImageData(0,0,size,size);
      const data = new Float32Array(1*3*size*size);
      for (let i = 0; i < size*size; i++) {
        const r = id.data[i*4+0] / 255;
        const g = id.data[i*4+1] / 255;
        const bch = id.data[i*4+2] / 255;
        data[i] = r; data[i + size*size] = g; data[i + 2*size*size] = bch;
      }
      const input = new ort.Tensor('float32', data, [1,3,size,size]);
      const out = await seg.run({ input: input }).then(o => o[Object.keys(o)[0]].data);
      const oh = size, ow = size;
      const alpha = new Uint8ClampedArray(b.w * b.h);
      for (let y = 0; y < b.h; y++) {
        for (let x = 0; x < b.w; x++) {
          const sx = Math.floor(x * ow / b.w);
          const sy = Math.floor(y * oh / b.h);
          const v = out[sy*ow + sx];
          const a = Math.max(0, Math.min(255, Math.round(v * 255)));
          alpha[y*b.w + x] = a;
        }
      }
      masks.push({ x: b.x, y: b.y, w: b.w, h: b.h, score: b.score, bitmap: alpha });
    }
    return masks;
  }

  return { detect, segment };
}

export { createDetector };
