/* Easy Abacus: central theme.
   Each app describes its palettes in shared roles; this module applies the viewer's choices
   (mode, accent, custom background and text colors), keeps every pairing at WCAG AA contrast,
   saves the choices through EasyAbacus.storage and renders the same theme controls in every app.

   Roles every base palette defines (hex colors):
     bg          page behind the app
     surface     main card or device body
     sunk        inset areas: displays, inputs
     raised      buttons and keys
     raisedAlt   secondary buttons and keys
     fg          text
     muted       secondary text
     line        borders
     danger      errors and destructive actions
   Added here: accent, accentSoft, accentText (text-safe accent), onAccent, onAccentText, onDanger.

   Saved:
     easyAbacus:shared:theme   { mode }                    mode follows the viewer across apps
     easyAbacus:<app>:theme    { accent, custom: { light: { bg, fg }, dark: { bg, fg } } } */
(function () {
  "use strict";
  const { storage } = window.EasyAbacus;

  // ---------- color math ----------
  const HEX = /^#[0-9a-f]{6}$/i;
  const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const toHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const x = toRgb(a), y = toRgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
  const lum = (h) => {
    const [r, g, b] = toRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const minContrast = (c, bgs) => Math.min(...bgs.map((b) => contrast(c, b)));
  const pickOn = (bg) => (contrast("#ffffff", bg) >= contrast("#111418", bg) ? "#ffffff" : "#111418");

  /** Nudges a color toward black or white until it reaches `min` contrast on every background. */
  function ensureContrast(color, bgs, min) {
    if (minContrast(color, bgs) >= min) return color;
    const avg = bgs.reduce((s, b) => s + lum(b), 0) / bgs.length;
    const order = avg > 0.25 ? ["#000000", "#ffffff"] : ["#ffffff", "#000000"];
    for (let t = 0.05; t <= 1.0001; t += 0.05) {
      for (const target of order) {
        const c = mix(color, target, t);
        if (minContrast(c, bgs) >= min) return c;
      }
    }
    return minContrast("#000000", bgs) > minContrast("#ffffff", bgs) ? "#000000" : "#ffffff";
  }

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function init(config) {
    const appStore = storage.createStore(config.app);
    const darkQuery = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : { matches: false };
    const listeners = [];

    function loadMode() {
      const m = (storage.shared.get("theme") || {}).mode;
      return ["system", "light", "dark"].includes(m) ? m : "system";
    }
    function loadAppTheme() {
      const t = appStore.get("theme") || {};
      const out = { accent: config.accents[t.accent] ? t.accent : config.defaultAccent, custom: { light: {}, dark: {} } };
      for (const m of ["light", "dark"]) {
        const c = (t.custom && t.custom[m]) || {};
        if (HEX.test(c.bg || "")) out.custom[m].bg = c.bg.toLowerCase();
        if (HEX.test(c.fg || "")) out.custom[m].fg = c.fg.toLowerCase();
      }
      return out;
    }

    const state = { mode: loadMode(), ...loadAppTheme() };
    let palette;
    let saveOk = true;

    const effectiveMode = () => (state.mode === "system" ? (darkQuery.matches ? "dark" : "light") : state.mode);

    function build(mode) {
      const base = config.base[mode];
      const acc = config.accents[state.accent][mode];
      const c = state.custom[mode];
      const p = { ...base, accent: acc.accent, accentSoft: acc.soft || mix(base.surface, acc.accent, 0.16), fgAuto: false };

      if (c.bg) {
        const light = lum(c.bg) > 0.18;
        p.surface = c.bg;
        p.bg = mix(c.bg, "#000000", light ? 0.08 : 0.35);
        p.sunk = mix(c.bg, "#000000", light ? 0.04 : 0.22);
        p.raised = light ? mix(c.bg, "#ffffff", 0.7) : mix(c.bg, "#ffffff", 0.08);
        p.raisedAlt = light ? mix(c.bg, "#000000", 0.08) : mix(c.bg, "#ffffff", 0.15);
        p.line = mix(c.bg, light ? "#000000" : "#ffffff", 0.24);
        p.accentSoft = mix(c.bg, acc.accent, 0.16);
      }
      const textBgs = [p.surface, p.sunk, p.raised, p.raisedAlt];
      if (c.fg) p.fg = c.fg;
      else if (c.bg && minContrast(p.fg, textBgs) < 4.5) { p.fg = ensureContrast(p.fg, textBgs, 7); p.fgAuto = true; }
      if (c.bg || c.fg) {
        // secondary text: as soft as it can be while staying at 4.5:1
        p.muted = p.fg;
        for (let t = 0.5; t > 0; t -= 0.05) {
          const m = mix(p.fg, p.sunk, t);
          if (minContrast(m, [p.surface, p.sunk]) >= 4.5) { p.muted = m; break; }
        }
      }
      p.onAccent = pickOn(p.accent);
      if (contrast(p.onAccent, p.accent) < 4.5) p.accent = ensureContrast(p.accent, [p.onAccent], 4.5);
      p.accentText = ensureContrast(acc.text || p.accent, [p.surface, p.sunk, p.raised, p.accentSoft], 4.5);
      p.onAccentText = pickOn(p.accentText);
      p.danger = ensureContrast(p.danger, [p.surface, p.sunk, p.raised, p.raisedAlt], 4.5);
      p.onDanger = pickOn(p.danger);
      if (config.derive) config.derive(p, mode, { ensureContrast, mix, pickOn, contrast });
      return p;
    }

    function apply() {
      const mode = effectiveMode();
      palette = build(mode);
      const root = document.documentElement;
      root.setAttribute("data-theme", mode);
      root.style.colorScheme = mode;
      const shared = {
        "--t-bg": palette.bg, "--t-surface": palette.surface, "--t-sunk": palette.sunk, "--t-raised": palette.raised,
        "--t-raised-alt": palette.raisedAlt, "--t-fg": palette.fg, "--t-muted": palette.muted, "--t-line": palette.line,
        "--t-accent": palette.accent, "--t-on-accent": palette.onAccent, "--t-accent-text": palette.accentText,
        "--t-accent-soft": palette.accentSoft, "--t-danger": palette.danger, "--t-on-danger": palette.onDanger,
      };
      for (const [k, v] of Object.entries({ ...shared, ...config.vars(palette, mode) })) root.style.setProperty(k, v);
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
      if (document.head) {
        const meta = document.createElement("meta");
        meta.name = "theme-color";
        meta.content = config.themeColor ? config.themeColor(palette) : palette.bg;
        document.head.appendChild(meta);
      }
      if (panel) syncPanel();
      listeners.forEach((fn) => fn(palette, mode));
    }

    function save() {
      const a = storage.shared.set("theme", { mode: state.mode });
      const b = appStore.set("theme", { accent: state.accent, custom: state.custom });
      saveOk = a && b;
    }

    function changed() { save(); apply(); announceSaved(); }

    // follow the device, other tabs and the other apps
    darkQuery.addEventListener?.("change", () => { if (state.mode === "system") apply(); });
    storage.shared.onChange("theme", () => { state.mode = loadMode(); apply(); });
    appStore.onChange("theme", () => { Object.assign(state, loadAppTheme()); apply(); });

    // ---------- the theme controls ----------
    let panel = null;
    let savedTimer;
    function announceSaved() {
      if (!panel) return;
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => {
        const el = panel.querySelector("[data-t=saved]");
        if (el) el.textContent = saveOk ? "Saved on this device" : "Can't save: this browser blocks storage";
      }, 500);
    }

    function render(container) {
      panel = container;
      const accents = Object.entries(config.accents).map(([key, a]) => `
        <input type="radio" name="t-accent" id="t-accent-${key}" value="${key}">
        <label for="t-accent-${key}"><span class="t-dot" aria-hidden="true"></span>${esc(a.name)}</label>`).join("");
      container.innerHTML = `
        <fieldset class="t-field">
          <legend>Mode</legend>
          <div class="t-seg">
            <input type="radio" name="t-mode" id="t-mode-system" value="system"><label for="t-mode-system">System</label>
            <input type="radio" name="t-mode" id="t-mode-light" value="light"><label for="t-mode-light">Light</label>
            <input type="radio" name="t-mode" id="t-mode-dark" value="dark"><label for="t-mode-dark">Dark</label>
          </div>
          <p class="t-note" data-t="modeNote"></p>
        </fieldset>
        <fieldset class="t-field">
          <legend>Accent color</legend>
          <div class="t-swatches">${accents}</div>
        </fieldset>
        <div class="t-field" role="group" aria-labelledby="t-colors-title">
          <h3 class="t-title" id="t-colors-title" data-t="colorsTitle">Colors</h3>
          <div class="t-color-row">
            <label for="t-bg">Background</label>
            <input type="color" id="t-bg" aria-describedby="t-bg-hex t-bg-state">
            <span class="t-hex" id="t-bg-hex"></span>
            <span class="t-state" id="t-bg-state"></span>
            <button type="button" class="t-link" data-t="bgReset">Use default</button>
          </div>
          <div class="t-color-row">
            <label for="t-fg">Text</label>
            <input type="color" id="t-fg" aria-describedby="t-fg-hex t-fg-state">
            <span class="t-hex" id="t-fg-hex"></span>
            <span class="t-state" id="t-fg-state"></span>
            <button type="button" class="t-link" data-t="fgReset">Use default</button>
          </div>
        </div>
        <div class="t-field" role="group" aria-labelledby="t-checks-title">
          <h3 class="t-title" id="t-checks-title">Contrast check (WCAG AA)</h3>
          <ul class="t-checks" data-t="checks"></ul>
          <p class="t-note">Text needs at least 4.5:1.</p>
          <div class="t-warn" data-t="warn" role="alert" hidden>
            <span>Text is hard to read with these colors.</span>
            <button type="button" class="t-btn" data-t="fix">Fix text color</button>
          </div>
        </div>
        <p class="t-saved" data-t="saved" role="status" aria-live="polite"></p>`;

      container.addEventListener("change", (e) => {
        const t = e.target;
        if (t.name === "t-mode") state.mode = t.value;
        else if (t.name === "t-accent") state.accent = t.value;
        else return;
        changed();
      });
      container.addEventListener("input", (e) => {
        if (e.target.id === "t-bg") state.custom[effectiveMode()].bg = e.target.value.toLowerCase();
        else if (e.target.id === "t-fg") state.custom[effectiveMode()].fg = e.target.value.toLowerCase();
        else return;
        changed();
      });
      container.addEventListener("click", (e) => {
        const b = e.target.closest("[data-t]");
        if (!b) return;
        const c = state.custom[effectiveMode()];
        if (b.dataset.t === "bgReset") { delete c.bg; changed(); container.querySelector("#t-bg").focus(); }
        if (b.dataset.t === "fgReset") { delete c.fg; changed(); container.querySelector("#t-fg").focus(); }
        if (b.dataset.t === "fix") {
          const p = palette;
          c.fg = ensureContrast(p.fg, [p.surface, p.sunk, p.raised, p.raisedAlt], 4.5);
          changed();
          container.querySelector("#t-fg").focus();
        }
      });
      syncPanel();
    }

    function row(label, ratio, min) {
      const pass = ratio >= min;
      return `<li><span>${label}</span><span><span class="t-ratio">${ratio.toFixed(1)}:1</span>
        <span class="t-badge ${pass ? "pass" : "fail"}">${pass ? "Pass" : "Fail"}</span></span></li>`;
    }

    function syncPanel() {
      const q = (s) => panel.querySelector(s);
      if (!q("#t-bg")) return;
      const mode = effectiveMode();
      const p = palette;
      const c = state.custom[mode];
      panel.querySelectorAll('input[name="t-mode"]').forEach((r) => { r.checked = r.value === state.mode; });
      panel.querySelectorAll('input[name="t-accent"]').forEach((r) => {
        r.checked = r.value === state.accent;
        const a = config.accents[r.value][mode].accent;
        r.nextElementSibling.style.setProperty("--t-sw", a);
        r.nextElementSibling.style.setProperty("--t-sw-fg", pickOn(a));
      });
      q("[data-t=modeNote]").textContent = (state.mode === "system"
        ? `Following your device, which is in ${mode} mode now. `
        : "") + "Mode is shared by all Easy Abacus apps. Light and dark mode keep separate colors.";
      q("[data-t=colorsTitle]").textContent = `Colors for ${mode} mode`;
      if (document.activeElement !== q("#t-bg")) q("#t-bg").value = p.surface;
      if (document.activeElement !== q("#t-fg")) q("#t-fg").value = p.fg;
      q("#t-bg-hex").textContent = p.surface;
      q("#t-fg-hex").textContent = p.fg;
      q("#t-bg-state").textContent = c.bg ? "Custom" : "Default";
      q("#t-fg-state").textContent = c.fg ? "Custom" : p.fgAuto ? "Adjusted for contrast" : "Default";
      q("[data-t=bgReset]").disabled = !c.bg;
      q("[data-t=fgReset]").disabled = !c.fg;
      const text = minContrast(p.fg, [p.surface, p.sunk, p.raised, p.raisedAlt]);
      q("[data-t=checks]").innerHTML =
        row("Text", text, 4.5) +
        row("Secondary text", minContrast(p.muted, [p.surface, p.sunk]), 4.5) +
        row("Accent text", minContrast(p.accentText, [p.surface, p.sunk, p.accentSoft]), 4.5) +
        row("Text on accent", contrast(p.onAccent, p.accent), 4.5);
      q("[data-t=warn]").hidden = text >= 4.5;
    }

    function reset() {
      state.mode = "system";
      state.accent = config.defaultAccent;
      state.custom = { light: {}, dark: {} };
      changed();
    }

    apply();

    return {
      get palette() { return palette; },
      get mode() { return effectiveMode(); },
      render,
      reset,
      onChange(fn) { listeners.push(fn); },
    };
  }

  window.EasyAbacus.theme = { init, contrast, ensureContrast, mix, pickOn };
})();
