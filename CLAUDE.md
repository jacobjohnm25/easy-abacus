# Easy Abacus: project rules

Every app in this repo, and every new one, must meet all of these without being asked.

## Every app must be
- **A progressive web app**: its own folder with `index.html`, `manifest.webmanifest` (name, icons 192/512/maskable, `start_url`/`scope` of `./`), and `sw.js` that precaches the app shell plus the `shared/` files it uses and works offline. Cache names start with the app's own prefix, and a worker deletes only caches with its prefix (all apps share one origin). Register the worker only on https or localhost and show an "Install app" button when `beforeinstallprompt` fires.
- **Fully responsive**: no sideways page scrolling from 280 px phones to 2560 px desktops, including short landscape phones (`orientation: landscape and max-height: 500px`). Respect safe-area insets. Touch targets at least 44 px. Inputs at least 16 px text.
- **WCAG 2.2 AA**: 4.5:1 text contrast in light and dark, keyboard access for everything with a visible focus ring, labelled controls, dialogs that trap focus and return it, a polite live region for results, `prefers-reduced-motion` and `forced-colors` support, and a way to turn off single-key shortcuts. Check with axe-core (wcag2a/aa, wcag21a/aa, wcag22aa) before pushing.
- **Themeable through `shared/theme.js`**: mode (system/light/dark, shared by all apps), accent presets, custom background and text colors per mode, the contrast check, and "Restore default settings". Describe the app's palettes in the shared roles and render the shared panel with `theme.render(el)`.
- **Saving through `shared/storage.js`**: settings and the last calculation (plus whatever the user typed) under `easyAbacus:<app-id>:<name>`. Never call `localStorage` directly. When a storage format changes, migrate the old key with `storage.migrate`.

## Shared modules (`shared/`)
- `storage.js`: `EasyAbacus.storage.createStore(appId)` returns `get/set/remove/onChange/clear`; `storage.shared` holds cross-app settings; `storage.migrate(oldKey, fn)`.
- `theme.js`: `EasyAbacus.theme.init({ app, base: { light, dark }, accents, defaultAccent, vars, themeColor, derive })`. Load it in `<head>` (with storage.js) so the theme is on screen before first paint.
- `theme.css`: styles for the shared theme panel (uses the `--t-*` variables theme.js sets).

## Layout
- `/` Live Tape Calculator, `/job-site/` Job Site Calculator, `/shared/` shared modules, `/scripts/` build helpers.
- Previews for claude.ai are built with `node scripts/build-artifact.mjs [app-folder]` (strips the document wrapper and rewrites `../shared/` to `shared/`).
- Icons: draw `icons/icon.svg` and `icons/icon-maskable.svg`, then `node scripts/render-icons.mjs [app-folder]`.
