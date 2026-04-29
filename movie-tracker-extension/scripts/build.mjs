import { build, context } from 'esbuild';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const isWatch = process.argv.includes('--watch');

const esbuildOptions = {
  entryPoints: [path.join(root, 'src', 'content', 'main.js')],
  outfile: path.join(distDir, 'content.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome114'],
  sourcemap: true,
  logLevel: 'info',
};

const distManifest = {
  manifest_version: 3,
  name: 'Смотрикс',
  version: '0.1.0',
  description: 'Расширение для отслеживания просмотра фильмов и сериалов',
  icons: {
    16: 'assets/smotrix-icon.png',
    32: 'assets/smotrix-icon.png',
    48: 'assets/smotrix-icon.png',
    128: 'assets/smotrix-icon.png',
  },
  action: {
    default_title: 'Смотрикс',
    default_icon: {
      16: 'assets/smotrix-icon.png',
      32: 'assets/smotrix-icon.png',
      48: 'assets/smotrix-icon.png',
      128: 'assets/smotrix-icon.png',
    },
    default_popup: 'popup/popup.html',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['content.js'],
      run_at: 'document_start',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['src/page/ivi-fetch-bridge.js'],
      matches: ['https://www.ivi.ru/*', 'https://*.ivi.ru/*'],
    },
    {
      resources: ['src/page/amediateka-watch-context-bridge.js'],
      matches: ['https://www.amediateka.ru/*', 'https://*.amediateka.ru/*'],
    },
  ],
  permissions: ['storage'],
  host_permissions: [],
};

async function writeDistManifest() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await writeFile(
    path.join(distDir, 'manifest.json'),
    `${JSON.stringify(distManifest, null, 2)}\n`,
    'utf8'
  );
}

async function copyPageScripts() {
  const targetDir = path.join(distDir, 'src', 'page');

  await mkdir(targetDir, { recursive: true });
  await copyFile(
    path.join(root, 'src', 'page', 'ivi-fetch-bridge.js'),
    path.join(targetDir, 'ivi-fetch-bridge.js')
  );
  await copyFile(
    path.join(root, 'src', 'page', 'amediateka-watch-context-bridge.js'),
    path.join(targetDir, 'amediateka-watch-context-bridge.js')
  );
}

async function copyPopupAssets() {
  const targetDir = path.join(distDir, 'popup');

  await mkdir(targetDir, { recursive: true });
  await copyFile(
    path.join(root, 'src', 'popup', 'popup.html'),
    path.join(targetDir, 'popup.html')
  );
  await copyFile(
    path.join(root, 'src', 'popup', 'popup.css'),
    path.join(targetDir, 'popup.css')
  );
  await copyFile(
    path.join(root, 'src', 'popup', 'popup.js'),
    path.join(targetDir, 'popup.js')
  );
}

async function copyExtensionAssets() {
  const targetDir = path.join(distDir, 'assets');

  await mkdir(targetDir, { recursive: true });
  await copyFile(
    path.join(root, 'src', 'assets', 'smotrix-icon.png'),
    path.join(targetDir, 'smotrix-icon.png')
  );
}

if (isWatch) {
  const ctx = await context(esbuildOptions);
  await writeDistManifest();
  await copyPageScripts();
  await copyPopupAssets();
  await copyExtensionAssets();
  await ctx.watch();
  console.log('[build] watch mode started');
} else {
  await writeDistManifest();
  await copyPageScripts();
  await copyPopupAssets();
  await copyExtensionAssets();
  await build(esbuildOptions);
  console.log('[build] done');
}
