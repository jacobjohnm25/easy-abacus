/* Job Site Calculator theme: palettes in the shared roles (see shared/theme.js).
   Loaded in <head> so the saved theme is on screen before the first paint. */
(function () {
  "use strict";
  if (!document.documentElement.lang) document.documentElement.lang = "en";
  window.JobSiteTheme = window.EasyAbacus.theme.init({
    app: "job-site",
    base: {
      light: {
        bg: "#e8eaec", surface: "#ffffff", sunk: "#f3f4f5", raised: "#ffffff", raisedAlt: "#eceef0",
        fg: "#1b2025", muted: "#525b64", line: "#c2c9cf", danger: "#9a3b12", good: "#1f6b3a",
      },
      dark: {
        bg: "#121417", surface: "#1b1f23", sunk: "#16191c", raised: "#22272c", raisedAlt: "#2a3036",
        fg: "#edf0f2", muted: "#a2abb4", line: "#3a4148", danger: "#ff9e6e", good: "#6fd08f",
      },
    },
    // Accents are fills (tool chips, buttons, the tape). Text-safe versions are worked out automatically.
    accents: {
      hivis:  { name: "Hi-vis yellow", light: { accent: "#f5b400" }, dark: { accent: "#ffc21a" } },
      orange: { name: "Safety orange", light: { accent: "#f28c28" }, dark: { accent: "#ff9d45" } },
      green:  { name: "Site green",    light: { accent: "#3fae5a" }, dark: { accent: "#5cc777" } },
      blue:   { name: "Blueprint",     light: { accent: "#2f7fd1" }, dark: { accent: "#5aa6f0" } },
      red:    { name: "Brick red",     light: { accent: "#d9473b" }, dark: { accent: "#ff6b5e" } },
    },
    defaultAccent: "hivis",
    // The result panel is dark in both modes, like a tape measure case.
    derive(p, mode, { ensureContrast }) {
      p.panel = mode === "light" ? "#1d2328" : "#262c32";
      p.onPanel = "#f1f3f5";
      p.panelMuted = "#b4bdc5";
      p.panelLine = "#3b444c";
      p.panelHi = ensureContrast(p.accent, [p.panel], 4.5);
      p.panelGood = "#7fd99c";
      p.panelWarn = "#ffab80";
      p.good = ensureContrast(p.good, [p.surface, p.sunk], 4.5);
    },
    vars: (p) => ({
      "--bg": p.bg, "--surface": p.surface, "--sunk": p.sunk, "--raised": p.raised, "--ink": p.fg, "--muted": p.muted,
      "--line": p.line, "--hi": p.accent, "--on-hi": p.onAccent, "--accent": p.accentText, "--warn": p.danger,
      "--on-warn": p.onDanger, "--good": p.good, "--panel": p.panel, "--on-panel": p.onPanel, "--panel-muted": p.panelMuted,
      "--panel-line": p.panelLine, "--panel-hi": p.panelHi, "--panel-good": p.panelGood, "--panel-warn": p.panelWarn,
    }),
    themeColor: (p) => p.bg,
  });
})();
