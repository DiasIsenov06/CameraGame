import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);

async function start() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) {
    throw new Error('Установите Node.js 22.12 или новее с https://nodejs.org/ и повторите запуск.');
  }

  const lockHash = createHash('sha256').update(readFileSync('package-lock.json')).digest('hex');
  const marker = 'node_modules/.gesture-drive-lock';
  const needsInstall = !existsSync(marker)
    || readFileSync(marker, 'utf8') !== lockHash
    || !existsSync('node_modules/vite/package.json')
    || !existsSync('public/mediapipe/wasm/vision_wasm_internal.wasm');

  if (needsInstall) {
    console.log('\nПервый запуск: устанавливаю зависимости. Нужен интернет, пожалуйста, подождите.\n');
    await new Promise((resolve, reject) => {
      // npm is a .cmd launcher on Windows; all shell arguments here are fixed.
      const child = spawn('npm', ['ci'], {
        cwd: root,
        shell: process.platform === 'win32',
        stdio: 'inherit',
      });
      child.once('error', reject);
      child.once('exit', (code) => code === 0
        ? resolve()
        : reject(new Error('Не удалось установить зависимости. Проверьте интернет и повторите запуск.')));
    });
    writeFileSync(marker, lockHash);
  }

  const { createServer } = await import('vite');
  const server = await createServer({
    root,
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: false,
      open: process.env.GESTURE_DRIVE_NO_OPEN !== '1',
    },
  });
  await server.listen();
  console.log('\nGESTURE DRIVE готова! Оставьте это окно открытым во время игры.');
  console.log('Если браузер не открылся, откройте адрес Local ниже в Chrome или Edge.');
  console.log('PLAY → ENABLE CAMERA → разрешите камеру → калибровка → START RACE.');
  console.log('Без камеры: Try keyboard mode. Для остановки сервера нажмите Ctrl+C.\n');
  server.printUrls();

  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    await server.close();
    process.exit(0);
  }
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

start().catch(error => {
  console.error(`\nОшибка запуска: ${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
});
