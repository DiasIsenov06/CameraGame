import { mkdir, copyFile } from 'node:fs/promises';
const target = new URL('../public/mediapipe/wasm/', import.meta.url);
await mkdir(target, { recursive: true });
for (const name of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
  await copyFile(new URL(`../node_modules/@mediapipe/tasks-vision/wasm/${name}`, import.meta.url), new URL(name, target));
}
console.log('MediaPipe WASM runtime copied to public/mediapipe/wasm.');
