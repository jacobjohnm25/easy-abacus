(() => {
  "use strict";

  // ---------- storage (every access can throw: private mode, blocked site data) ----------
  const KEYS = { history: "liveTapeCalc.history.v1", settings: "liveTapeCalc.settings.v1" };
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  };

  // ---------- color helpers ----------
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
  const pickOn = (bg) => (contrast("#ffffff", bg) >= contrast("#0b1620", bg) ? "#ffffff" : "#0b1620");

  // Nudge a color toward black or white until it reaches `min` contrast on every background.
  function ensureContrast(color, bgs, min) {
    if (minContrast(color, bgs) >= min) return color;
    const avgLum = bgs.reduce((s, b) => s + lum(b), 0) / bgs.length;
    const order = avgLum > 0.25 ? ["#000000", "#ffffff"] : ["#ffffff", "#000000"];
    for (let t = 0.05; t <= 1.0001; t += 0.05) {
      for (const target of order) {
        const c = mix(color, target, t);
        if (minContrast(c, bgs) >= min) return c;
      }
    }
    return minContrast("#000000", bgs) > minContrast("#ffffff", bgs) ? "#000000" : "#ffffff";
  }

  // ---------- theme ----------
  const BASE = {
    light: {
      bg: "#e6ebf0", device: "#f6f8fa", screen: "#eef2f5", key: "#ffffff", keyFn: "#dde4eb",
      fg: "#16212c", muted: "#536170", line: "#b7c3cf", danger: "#a83a27",
      shadow: "0 1px 0 rgba(22, 33, 44, .08), 0 18px 40px -18px rgba(22, 33, 44, .28)",
    },
    dark: {
      bg: "#0e1318", device: "#161d24", screen: "#11171d", key: "#212a33", keyFn: "#2a3540",
      fg: "#e6edf3", muted: "#9aa8b6", line: "#435160", danger: "#f19a87",
      shadow: "0 1px 0 rgba(0, 0, 0, .4), 0 18px 40px -18px rgba(0, 0, 0, .7)",
    },
  };
  // Every preset passes 4.5:1 on the display, the keys and its own tint in both modes.
  const ACCENTS = {
    blue:   { name: "Blue",   light: { accent: "#1d5c8a", soft: "#d6e5f1" }, dark: { accent: "#74b6e6", soft: "#1c3446" } },
    teal:   { name: "Teal",   light: { accent: "#0f6b62", soft: "#d3ebe7" }, dark: { accent: "#5cc4b6", soft: "#17352f" } },
    violet: { name: "Violet", light: { accent: "#5b45a8", soft: "#e3defa" }, dark: { accent: "#a99af0", soft: "#2a2547" } },
    rose:   { name: "Rose",   light: { accent: "#a8325a", soft: "#f6dbe4" }, dark: { accent: "#f08fb0", soft: "#42202d" } },
    amber:  { name: "Amber",  light: { accent: "#8a5300", soft: "#f6e6c8" }, dark: { accent: "#e8b25a", soft: "#3b2c12" } },
  };
  const DEFAULT_SETTINGS = { mode: "system", accent: "blue", custom: { light: {}, dark: {} }, shortcuts: true };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function loadSettings() {
    const s = store.get(KEYS.settings) || {};
    const out = clone(DEFAULT_SETTINGS);
    if (["system", "light", "dark"].includes(s.mode)) out.mode = s.mode;
    if (ACCENTS[s.accent]) out.accent = s.accent;
    if (typeof s.shortcuts === "boolean") out.shortcuts = s.shortcuts;
    for (const m of ["light", "dark"]) {
      const c = (s.custom && s.custom[m]) || {};
      if (HEX.test(c.bg || "")) out.custom[m].bg = c.bg.toLowerCase();
      if (HEX.test(c.fg || "")) out.custom[m].fg = c.fg.toLowerCase();
    }
    return out;
  }

  let settings = loadSettings();
  const darkQuery = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : { matches: false };
  const effectiveMode = () => (settings.mode === "system" ? (darkQuery.matches ? "dark" : "light") : settings.mode);

  function buildPalette(mode) {
    const base = BASE[mode];
    const acc = ACCENTS[settings.accent][mode];
    const c = settings.custom[mode];
    const p = { ...base, accent: acc.accent, accentSoft: acc.soft, fgAuto: false };

    if (c.bg) {
      const lightBg = lum(c.bg) > 0.18;
      p.device = c.bg;
      p.bg = mix(c.bg, "#000000", lightBg ? 0.08 : 0.35);
      p.screen = mix(c.bg, "#000000", lightBg ? 0.04 : 0.22);
      p.key = lightBg ? mix(c.bg, "#ffffff", 0.7) : mix(c.bg, "#ffffff", 0.08);
      p.keyFn = lightBg ? mix(c.bg, "#000000", 0.08) : mix(c.bg, "#ffffff", 0.15);
      p.line = mix(c.bg, lightBg ? "#000000" : "#ffffff", 0.24);
      p.accentSoft = mix(c.bg, acc.accent, 0.16);
    }
    const textBgs = [p.key, p.keyFn, p.screen, p.device];
    if (c.fg) p.fg = c.fg;
    else if (c.bg && minContrast(p.fg, textBgs) < 4.5) { p.fg = ensureContrast(p.fg, textBgs, 7); p.fgAuto = true; }

    if (c.bg || c.fg) {
      // secondary text: as soft as possible while still 4.5:1
      p.muted = p.fg;
      for (let t = 0.5; t > 0; t -= 0.05) {
        const m = mix(p.fg, p.screen, t);
        if (minContrast(m, [p.screen, p.device]) >= 4.5) { p.muted = m; break; }
      }
    }
    p.accent = ensureContrast(p.accent, [p.screen, p.key, p.accentSoft, p.device], 4.5);
    p.accentFg = pickOn(p.accent);
    p.danger = ensureContrast(p.danger, [p.screen, p.key, p.keyFn, p.device], 4.5);
    p.dangerFg = pickOn(p.danger);
    return p;
  }

  const root = document.documentElement;
  if (!root.lang) root.lang = "en";
  let palette;

  function applyTheme() {
    const mode = effectiveMode();
    palette = buildPalette(mode);
    root.setAttribute("data-theme", mode);
    const vars = {
      bg: palette.bg, device: palette.device, screen: palette.screen, key: palette.key, "key-fn": palette.keyFn,
      fg: palette.fg, muted: palette.muted, line: palette.line, accent: palette.accent,
      "accent-soft": palette.accentSoft, "accent-fg": palette.accentFg, danger: palette.danger,
      "danger-fg": palette.dangerFg, shadow: palette.shadow,
    };
    for (const [k, v] of Object.entries(vars)) root.style.setProperty("--" + k, v);
    root.style.colorScheme = mode;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta && document.head) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    if (meta) meta.content = palette.device;
  }
  applyTheme();   // runs in <head>, before first paint

  // ---------- everything below needs the DOM ----------
  function init() {
    const $ = (id) => document.getElementById(id);
    const OPS = "+−×÷";
    const HISTORY_LIMIT = 20;

    const appMain = $("appMain");
    const exprEl = $("expr");
    const resultEl = $("result");
    const srStatus = $("srStatus");
    const recentEl = $("recent");
    const historyModal = $("historyModal");
    const historyListEl = $("historyList");
    const historyEmptyEl = $("historyEmpty");
    const settingsModal = $("settingsModal");
    const openHistoryBtn = $("openHistory");
    const openSettingsBtn = $("openSettings");

    function loadHistory() {
      const h = store.get(KEYS.history);
      if (!Array.isArray(h)) return [];
      return h.filter((x) => x && typeof x.expr === "string" && typeof x.value === "number" && isFinite(x.value))
        .slice(-HISTORY_LIMIT);
    }
    let history = loadHistory();   // oldest first
    let expr = history.length ? "" : "12+7×3";   // a worked example on the very first visit
    let justEvaluated = false;
    let errorMsg = null;
    const saveHistory = () => store.set(KEYS.history, history);

    // ---------- evaluation (recursive descent, no eval) ----------
    function tokenize(s) {
      const out = [];
      let i = 0;
      while (i < s.length) {
        const c = s[i];
        if (/[0-9.]/.test(c)) {
          let j = i;
          while (j < s.length && /[0-9.]/.test(s[j])) j++;
          out.push({ t: "num", v: s.slice(i, j) });
          i = j;
          continue;
        }
        if (c === "−") {
          const prev = out[out.length - 1];
          const unary = !prev || prev.t === "op" || prev.t === "neg" || prev.v === "(";
          out.push(unary ? { t: "neg", v: c } : { t: "op", v: c });
        } else if (OPS.includes(c)) out.push({ t: "op", v: c });
        else if (c === "(" || c === ")") out.push({ t: "paren", v: c });
        else if (c === "%") out.push({ t: "pct", v: c });
        i++;
      }
      return out;
    }

    function evaluate(s) {
      const toks = tokenize(s);
      let p = 0;
      const peek = () => toks[p];
      const fail = () => { throw new Error("Incomplete expression"); };

      function parseExpr() {
        let v = parseTerm();
        while (peek() && peek().t === "op" && (peek().v === "+" || peek().v === "−")) {
          const o = toks[p++].v;
          const r = parseTerm();
          v = o === "+" ? v + r : v - r;
        }
        return v;
      }
      function parseTerm() {
        let v = parseFactor();
        while (peek() && peek().t === "op" && (peek().v === "×" || peek().v === "÷")) {
          const o = toks[p++].v;
          const r = parseFactor();
          if (o === "÷" && r === 0) throw new Error("Cannot divide by zero");
          v = o === "×" ? v * r : v / r;
        }
        return v;
      }
      function parseFactor() {
        if (peek() && peek().t === "neg") { p++; return -parseFactor(); }
        let v = parsePrimary();
        while (peek() && peek().t === "pct") { p++; v = v / 100; }
        return v;
      }
      function parsePrimary() {
        const tk = toks[p++];
        if (!tk) fail();
        if (tk.t === "num") {
          if (tk.v === ".") fail();
          return parseFloat(tk.v);
        }
        if (tk.v === "(") {
          const v = parseExpr();
          if (peek() && peek().v === ")") p++;   // missing ")" at the end is auto-closed
          return v;
        }
        fail();
      }

      const v = parseExpr();
      if (p < toks.length) fail();
      if (!isFinite(v)) throw new Error("Number too large");
      return v;
    }

    // Preview: ignore a dangling operator or "(" so the result tracks as you type.
    function preview(s) {
      let t = s;
      while (t && /[+−×÷(]$/.test(t)) t = t.slice(0, -1);
      if (!t) return null;
      try { return { value: evaluate(t) }; }
      catch (e) { return e.message === "Incomplete expression" ? null : { error: e.message }; }
    }

    // ---------- formatting ----------
    function fmt(n) {
      const r = Number(n.toPrecision(12));       // trims float noise like 0.1+0.2
      if (Object.is(r, -0)) return "0";
      const abs = Math.abs(r);
      if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) {
        return r.toExponential(8).replace(/\.?0+e/, "e").replace("e+", "e");
      }
      return r.toLocaleString("en-US", { maximumFractionDigits: 10 });
    }
    function groupTyped(numStr) {                  // keep what was typed, add thousands separators
      const [int, dec] = numStr.split(".");
      const g = (int || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return dec !== undefined ? g + "." + dec : (int === "" ? "0" : g);
    }
    const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

    function exprHTML(s, { ghosts = true } = {}) {
      let html = "";
      let open = 0;
      for (const tk of tokenize(s)) {
        if (tk.t === "num") html += esc(groupTyped(tk.v));
        else if (tk.t === "op") html += `<span class="op">${tk.v}</span>`;
        else if (tk.t === "neg") html += `<span class="neg">−</span>`;
        else if (tk.t === "pct") html += `<span class="pct">%</span>`;
        else {
          open += tk.v === "(" ? 1 : -1;
          html += `<span class="paren">${tk.v}</span>`;
        }
      }
      if (ghosts && open > 0) html += `<span class="ghost" title="Closed automatically">${")".repeat(open)}</span>`;
      return html;
    }

    // Words for screen readers, e.g. "12 plus 7 times 3".
    const WORDS = { "+": "plus", "−": "minus", "×": "times", "÷": "divided by", "%": "percent", "(": "open bracket", ")": "close bracket" };
    function speak(s) {
      return tokenize(s).map((tk) => tk.t === "num" ? tk.v : tk.t === "neg" ? "negative" : WORDS[tk.v]).join(" ");
    }
    let announceTimer;
    function announce(text, delay = 450) {
      clearTimeout(announceTimer);
      announceTimer = setTimeout(() => { srStatus.textContent = text; }, delay);
    }

    const sizeClass = (text) => (text.length > 16 ? "xs" : text.length > 11 ? "sm" : "");
    const itemLabel = (h) => `${speak(h.expr)} equals ${fmt(h.value)}`;

    // ---------- render ----------
    function render() {
      const latest = history.length - 1;
      recentEl.innerHTML = latest < 0
        ? `<span class="empty">Your last calculation appears here</span>`
        : `<button type="button" class="h-item" data-i="${latest}" aria-label="Last calculation: ${esc(itemLabel(history[latest]))}. Add result to calculation">
            <span class="t-expr">${exprHTML(history[latest].expr, { ghosts: false })} <span class="eq-sign">=</span></span>
            <span class="t-res">${fmt(history[latest].value)}</span>
          </button>`;
      $("historyCount").textContent = history.length;
      openHistoryBtn.setAttribute("aria-label", `History, ${history.length} saved calculation${history.length === 1 ? "" : "s"}`);
      if (!historyModal.hidden) renderHistory();

      resultEl.className = "result";
      if (errorMsg) {
        exprEl.innerHTML = exprHTML(expr) + `<span class="eq-sign">=</span>`;
        resultEl.textContent = errorMsg;
        resultEl.classList.add("error");
        return;
      }
      if (justEvaluated) {
        const last = history[history.length - 1];
        exprEl.innerHTML = exprHTML(last.expr, { ghosts: false }) + `<span class="eq-sign">=</span>`;
        const txt = fmt(last.value);
        resultEl.textContent = txt;
        resultEl.classList.add("final");
        if (sizeClass(txt)) resultEl.classList.add(sizeClass(txt));
        return;
      }

      exprEl.innerHTML = (expr ? exprHTML(expr) : `<span class="placeholder">0</span>`) + `<span class="caret" aria-hidden="true"></span>`;
      const pv = preview(expr);
      if (!pv) { resultEl.textContent = expr ? "" : "0"; return; }
      if (pv.error) {
        resultEl.textContent = pv.error;
        resultEl.classList.add("error");
        return;
      }
      const txt = "= " + fmt(pv.value);
      resultEl.textContent = txt;
      if (sizeClass(txt)) resultEl.classList.add(sizeClass(txt));
    }

    function announceState() {
      if (errorMsg) return announce(errorMsg, 0);
      if (justEvaluated) return announce(`Result ${fmt(history[history.length - 1].value)}`, 0);
      if (!expr) return announce("Cleared");
      const pv = preview(expr);
      announce(speak(expr) + (pv ? (pv.error ? `. ${pv.error}` : `, equals ${fmt(pv.value)}`) : ""));
    }

    // ---------- input ----------
    const last = () => expr.slice(-1);
    const endsValue = () => /[0-9.)%]$/.test(expr);
    const openCount = () => [...expr].reduce((n, c) => n + (c === "(") - (c === ")"), 0);
    const currentNumber = () => (expr.match(/[0-9.]*$/) || [""])[0];

    // Turn a result into expression text (unary minus as "−", no exponent form).
    function valueToExpr(v) {
      let s = String(Number(v.toPrecision(12)));
      if (s.includes("e")) s = Number(s).toFixed(20).replace(/\.?0+$/, "");
      return s.replace("-", "−");
    }

    function startFromResult(continueWithResult) {
      if (!justEvaluated && !errorMsg) return;
      const prev = history[history.length - 1];
      expr = continueWithResult && !errorMsg && prev ? valueToExpr(prev.value) : "";
      justEvaluated = false;
      errorMsg = null;
    }

    function press(k) {
      if (/^[0-9]$/.test(k)) {
        startFromResult(false);
        if (last() === ")" || last() === "%") expr += "×";
        if (currentNumber() === "0") expr = expr.slice(0, -1);      // no leading zeros
        expr += k;
      } else if (k === ".") {
        startFromResult(false);
        if (last() === ")" || last() === "%") expr += "×";
        const n = currentNumber();
        if (!n.includes(".")) expr += n === "" ? "0." : ".";
      } else if (OPS.includes(k)) {
        startFromResult(true);
        if (expr === "" || last() === "(") {
          if (k === "−") expr += "−";              // allow a leading negative
        } else if (OPS.includes(last())) {
          // replace the operator; allow "×−" / "÷−" for a negative factor
          const prevC = expr.slice(-2, -1);
          if (k === "−" && (last() === "×" || last() === "÷")) expr += "−";
          else if (OPS.includes(prevC) && last() === "−") expr = expr.slice(0, -2) + k;
          else if (prevC === "" || prevC === "(") { if (k === "−") expr = expr.slice(0, -1) + k; }
          else expr = expr.slice(0, -1) + k;
        } else if (last() === ".") {
          expr = expr.slice(0, -1) + k;
        } else expr += k;
      } else if (k === "(") {
        startFromResult(false);
        if (endsValue()) expr += "×";
        expr += "(";
      } else if (k === ")") {
        startFromResult(true);
        if (openCount() > 0 && endsValue()) expr += ")";
      } else if (k === "%") {
        startFromResult(true);
        if (/[0-9)]$/.test(expr)) expr += "%";
      } else if (k === "neg") {
        startFromResult(true);
        toggleSign();
      } else if (k === "back") {
        if (justEvaluated || errorMsg) startFromResult(true);
        else expr = expr.slice(0, -1);
      } else if (k === "C") {
        expr = ""; justEvaluated = false; errorMsg = null;
      } else if (k === "=") {
        equals();
      }
      render();
      announceState();
    }

    function toggleSign() {
      const n = currentNumber();
      if (n === "") {
        // no number at the end: start one with a minus, or remove a dangling unary minus
        if (last() === "−" && (expr.length === 1 || /[+−×÷(]/.test(expr.slice(-2, -1)))) expr = expr.slice(0, -1);
        else if (!endsValue()) expr += "−";
        return;
      }
      const before = expr.slice(0, expr.length - n.length);
      const unaryBefore = before.endsWith("−") && (before.length === 1 || /[+−×÷(]/.test(before.slice(-2, -1)));
      expr = unaryBefore ? before.slice(0, -1) + n : before + "−" + n;
    }

    function equals() {
      if (justEvaluated || errorMsg || !expr) return;
      let t = expr;
      while (/[+−×÷(.]$/.test(t)) t = t.slice(0, -1);
      if (!t) return;
      t += ")".repeat(Math.max(0, [...t].reduce((n, c) => n + (c === "(") - (c === ")"), 0)));
      try {
        const value = evaluate(t);
        history.push({ expr: t, value });
        if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
        saveHistory();
        expr = t;
        justEvaluated = true;
      } catch (e) {
        expr = t;
        errorMsg = e.message === "Incomplete expression" ? "Check the expression" : e.message;
      }
    }

    // Add a past result to the current calculation.
    function useHistoryItem(i) {
      const h = history[i];
      if (!h) return;
      const v = valueToExpr(h.value);
      if (justEvaluated || errorMsg || expr === "") { expr = v; justEvaluated = false; errorMsg = null; }
      else {
        if (endsValue()) expr += "×";
        expr += v.startsWith("−") ? "(" + v + ")" : v;
      }
      render();
      announceState();
    }

    // ---------- modals ----------
    let activeModal = null;
    let modalOpener = null;
    const focusables = (el) => [...el.querySelectorAll("button, input, [tabindex]:not([tabindex='-1'])")]
      .filter((n) => !n.disabled && n.offsetParent !== null);

    function openModal(modal, opener, focusEl) {
      if (activeModal) closeModal(false);
      activeModal = modal;
      modalOpener = opener;
      modal.hidden = false;
      appMain.inert = true;
      appMain.setAttribute("aria-hidden", "true");
      (focusEl || focusables(modal)[0]).focus();
    }
    function closeModal(restoreFocus = true) {
      if (!activeModal) return;
      activeModal.hidden = true;
      activeModal = null;
      appMain.inert = false;
      appMain.removeAttribute("aria-hidden");
      if (restoreFocus && modalOpener) modalOpener.focus();
    }
    for (const m of [historyModal, settingsModal]) {
      m.addEventListener("click", (e) => { if (e.target === m) closeModal(); });
    }
    document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => closeModal()));

    // history modal
    function renderHistory() {
      const items = history.map((h, i) => ({ h, i })).reverse();   // newest first
      historyListEl.innerHTML = items.map(({ h, i }, n) =>
        `<li><button type="button" class="h-item" data-i="${i}" aria-label="${n + 1}. ${esc(itemLabel(h))}. Add result to calculation">
          <span class="h-num" aria-hidden="true">(${n + 1})</span>
          <span class="t-expr" aria-hidden="true">${exprHTML(h.expr, { ghosts: false })} <span class="eq-sign">=</span></span>
          <span class="t-res" aria-hidden="true">${fmt(h.value)}</span>
        </button></li>`).join("");
      historyListEl.hidden = items.length === 0;
      historyEmptyEl.hidden = items.length > 0;
      $("clearHistory").disabled = items.length === 0;
    }
    function openHistory() {
      renderHistory();
      historyListEl.scrollTop = 0;
      openModal(historyModal, openHistoryBtn, historyListEl.querySelector("button") || $("closeHistory"));
    }
    openHistoryBtn.addEventListener("click", openHistory);
    recentEl.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-i]");
      if (b) useHistoryItem(+b.dataset.i);
    });
    historyListEl.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-i]");
      if (!b) return;
      useHistoryItem(+b.dataset.i);
      closeModal();
    });
    $("clearHistory").addEventListener("click", () => {
      history = [];
      justEvaluated = false;
      saveHistory();
      render();
      renderHistory();
      $("closeHistory").focus();
      announce("History cleared", 0);
    });

    // ---------- settings modal ----------
    const swatchesEl = $("accentSwatches");
    swatchesEl.innerHTML = Object.entries(ACCENTS).map(([key, a]) =>
      `<input type="radio" name="accent" id="accent-${key}" value="${key}">
       <label for="accent-${key}"><span class="dot" aria-hidden="true"></span>${a.name}</label>`).join("");

    let savedTimer;
    function saveSettings() {
      const ok = store.set(KEYS.settings, settings);
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => {
        $("savedNote").textContent = ok ? "Saved on this device" : "Can't save: this browser blocks storage";
      }, 500);
    }

    function ratioRow(label, ratio, min) {
      const pass = ratio >= min;
      return `<li><span>${label}</span><span><span class="ratio">${ratio.toFixed(1)}:1</span>
        <span class="badge ${pass ? "pass" : "fail"}">${pass ? "Pass" : "Fail"}</span></span></li>`;
    }

    function renderSettings() {
      const mode = effectiveMode();
      const p = palette;
      const c = settings.custom[mode];
      document.querySelectorAll('input[name="mode"]').forEach((r) => { r.checked = r.value === settings.mode; });
      document.querySelectorAll('input[name="accent"]').forEach((r) => {
        r.checked = r.value === settings.accent;
        const a = ACCENTS[r.value][mode].accent;
        r.nextElementSibling.style.setProperty("--sw", a);
        r.nextElementSibling.style.setProperty("--sw-fg", pickOn(a));
      });
      $("colorsTitle").textContent = `Colors for ${mode} mode`;
      $("modeNote").textContent = settings.mode === "system"
        ? `Following your device, which is in ${mode} mode now. Light and dark mode keep separate colors.`
        : "Light and dark mode keep separate colors.";

      $("bgColor").value = p.device;
      $("bgHex").textContent = p.device;
      $("bgState").textContent = c.bg ? "Custom" : "Default";
      $("bgReset").disabled = !c.bg;
      $("fgColor").value = p.fg;
      $("fgHex").textContent = p.fg;
      $("fgState").textContent = c.fg ? "Custom" : p.fgAuto ? "Adjusted for contrast" : "Default";
      $("fgReset").disabled = !c.fg;

      const textKeys = Math.min(contrast(p.fg, p.key), contrast(p.fg, p.keyFn));
      const textScreen = Math.min(contrast(p.fg, p.screen), contrast(p.fg, p.device));
      $("checks").innerHTML =
        ratioRow("Text on keys", textKeys, 4.5) +
        ratioRow("Text on display", textScreen, 4.5) +
        ratioRow("Secondary text", Math.min(contrast(p.muted, p.screen), contrast(p.muted, p.device)), 4.5) +
        ratioRow("Accent text", Math.min(contrast(p.accent, p.screen), contrast(p.accent, p.accentSoft)), 4.5) +
        ratioRow("Equals key", contrast(p.accentFg, p.accent), 3);
      $("contrastWarn").hidden = textKeys >= 4.5 && textScreen >= 4.5;

      $("shortcuts").checked = settings.shortcuts;
      $("hint").textContent = settings.shortcuts
        ? "Keyboard works too: digits, + − * /, ( ), %, Enter, Backspace, Esc, H for history"
        : "Keyboard shortcuts are off. Turn them on in Theme.";
    }

    function themeChanged() {
      applyTheme();
      renderSettings();
      saveSettings();
    }

    settingsModal.addEventListener("change", (e) => {
      const t = e.target;
      if (t.name === "mode") settings.mode = t.value;
      else if (t.name === "accent") settings.accent = t.value;
      else if (t.id === "shortcuts") settings.shortcuts = t.checked;
      else return;
      themeChanged();
    });
    // color inputs update live while dragging
    $("bgColor").addEventListener("input", (e) => { settings.custom[effectiveMode()].bg = e.target.value.toLowerCase(); themeChanged(); });
    $("fgColor").addEventListener("input", (e) => { settings.custom[effectiveMode()].fg = e.target.value.toLowerCase(); themeChanged(); });
    $("bgReset").addEventListener("click", () => { delete settings.custom[effectiveMode()].bg; themeChanged(); $("bgColor").focus(); });
    $("fgReset").addEventListener("click", () => { delete settings.custom[effectiveMode()].fg; themeChanged(); $("fgColor").focus(); });
    $("fixContrast").addEventListener("click", () => {
      const p = palette;
      settings.custom[effectiveMode()].fg = ensureContrast(p.fg, [p.key, p.keyFn, p.screen, p.device], 4.5);
      themeChanged();
      announce("Text color adjusted to meet 4.5 to 1 contrast", 0);
      $("fgColor").focus();
    });

    $("resetBtn").addEventListener("click", () => {
      $("resetConfirm").hidden = false;
      $("resetBtn").hidden = true;
      $("resetNo").focus();
    });
    $("resetNo").addEventListener("click", () => {
      $("resetConfirm").hidden = true;
      $("resetBtn").hidden = false;
      $("resetBtn").focus();
    });
    $("resetYes").addEventListener("click", () => {
      settings = clone(DEFAULT_SETTINGS);
      if ($("resetHistory").checked) {
        history = [];
        justEvaluated = false;
        saveHistory();
        render();
      }
      $("resetHistory").checked = false;
      $("resetConfirm").hidden = true;
      $("resetBtn").hidden = false;
      themeChanged();
      $("resetBtn").focus();
      announce("Default settings restored", 0);
    });

    openSettingsBtn.addEventListener("click", () => {
      renderSettings();
      $("savedNote").textContent = "";
      openModal(settingsModal, openSettingsBtn);
    });

    darkQuery.addEventListener?.("change", () => {
      if (settings.mode !== "system") return;
      applyTheme();
      renderSettings();
    });

    // ---------- install (PWA) ----------
    let installEvent = null;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      installEvent = e;
      $("installField").hidden = false;
    });
    $("installBtn").addEventListener("click", async () => {
      if (!installEvent) return;
      installEvent.prompt();
      try { await installEvent.userChoice; } catch { /* dismissed */ }
      installEvent = null;
      $("installField").hidden = true;
    });
    window.addEventListener("appinstalled", () => { $("installField").hidden = true; });

    if ("serviceWorker" in navigator && (location.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
      navigator.serviceWorker.register("sw.js").catch(() => { /* not available here; the app still works online */ });
    }

    // ---------- keyboard ----------
    $("keys").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-k]");
      if (b) press(b.dataset.k);
    });

    const keyMap = {
      "*": "×", "x": "×", "X": "×", "/": "÷", "-": "−", "+": "+",
      "Enter": "=", "=": "=", "Backspace": "back", "Escape": "C", "Delete": "C",
      "(": "(", ")": ")", "%": "%", ".": ".", ",": ".",
    };
    document.addEventListener("keydown", (e) => {
      if (activeModal) {
        if (e.key === "Escape") { e.preventDefault(); closeModal(); return; }
        if (e.key === "Tab") {                       // keep focus inside the open modal
          const f = focusables(activeModal);
          if (!f.length) return;
          const first = f[0], lastF = f[f.length - 1];
          if (e.shiftKey && (document.activeElement === first || !activeModal.contains(document.activeElement))) { e.preventDefault(); lastF.focus(); }
          else if (!e.shiftKey && (document.activeElement === lastF || !activeModal.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
        }
        return;
      }
      if (!settings.shortcuts || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t.matches && t.matches("input, textarea, select")) return;
      // Enter/Space on a keyboard-focused button activates that button as usual
      if ((e.key === "Enter" || e.key === " ") && t.tagName === "BUTTON" && t.matches(":focus-visible")) return;
      if (e.key === "h" || e.key === "H") { e.preventDefault(); openHistory(); return; }
      const k = /^[0-9]$/.test(e.key) ? e.key : keyMap[e.key];
      if (!k) return;
      e.preventDefault();
      press(k);
      const btn = document.querySelector(`.keys button[data-k="${CSS.escape(k)}"]`);
      if (btn) { btn.classList.add("pressed"); setTimeout(() => btn.classList.remove("pressed"), 110); }
    });

    render();
    renderSettings();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
