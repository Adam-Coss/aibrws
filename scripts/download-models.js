import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const MODELS = [
  {
    name: 'rtdetr_r50vd.onnx',
    url: 'https://huggingface.co/onnx-community/rtdetr_r50vd/resolve/main/model.onnx'
  },
  {
    name: 'u2net_human_seg.onnx',
    url: 'https://huggingface.co/jellybox/u2net-human-seg/resolve/main/u2net_human_seg.onnx'
  }
];

const destDir = path.join(process.cwd(), 'assets', 'models');
fs.mkdirSync(destDir, { recursive: true });

for (const m of MODELS) {
  const dst = path.join(destDir, m.name);
  if (fs.existsSync(dst)) { console.log('✓', m.name, '(exists)'); continue; }
  console.log('↓ downloading', m.name);
  const res = await fetch(m.url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + m.url);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dst, buf);
  console.log('✓ saved', dst);
}
console.log('Models ready.');
