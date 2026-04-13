# Build setup (Chrome Extension MV3)

## Install
```bash
npm install
```

## Build once
```bash
npm run build
```

## Build in watch mode
```bash
npm run watch
```

Result: `dist/content.js` and `dist/manifest.json`.

## Load extension in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select folder `dist/`
