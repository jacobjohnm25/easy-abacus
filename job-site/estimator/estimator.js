(() => {
  "use strict";
  const { storage } = window.EasyAbacus;          // shared/storage.js
  const theme = window.JobSiteTheme;              // ../theme-config.js (shared/theme.js)
  const store = storage.createStore("job-site");  // easyAbacus:job-site:estimator, :estimate
  const $ = (id) => document.getElementById(id);

  // ---------- what the big-box stores stock (US nominal sizes) ----------
  // t × w are actual dressed sizes in inches; lengths are the common stocked lengths in feet.
  const PROFILES = {
    "1x2": { t: 0.75, w: 1.5, lengths: [6, 8] },
    "1x3": { t: 0.75, w: 2.5, lengths: [6, 8] },
    "1x4": { t: 0.75, w: 3.5, lengths: [6, 8, 10, 12] },
    "1x6": { t: 0.75, w: 5.5, lengths: [6, 8, 10, 12] },
    "1x8": { t: 0.75, w: 7.25, lengths: [6, 8, 10, 12] },
    "1x10": { t: 0.75, w: 9.25, lengths: [6, 8, 10, 12] },
    "1x12": { t: 0.75, w: 11.25, lengths: [6, 8, 10, 12] },
    "2x2": { t: 1.5, w: 1.5, lengths: [8] },
    "2x3": { t: 1.5, w: 2.5, lengths: [8] },
    "2x4": { t: 1.5, w: 3.5, lengths: [8, 10, 12, 16] },
    "2x6": { t: 1.5, w: 5.5, lengths: [8, 10, 12, 16] },
    "2x8": { t: 1.5, w: 7.25, lengths: [8, 10, 12, 16] },
    "2x10": { t: 1.5, w: 9.25, lengths: [8, 10, 12, 16] },
    "2x12": { t: 1.5, w: 11.25, lengths: [8, 10, 12, 16] },
    "4x4": { t: 3.5, w: 3.5, lengths: [8, 10, 12] },
  };
  // Sheets come as full 4 × 8 ft sheets or 2 × 4 and 2 × 2 ft project panels.
  const SHEETS = {
    "ply-3/4": { name: "3/4 in plywood", t: 0.75 },
    "ply-1/2": { name: "1/2 in plywood", t: 0.5 },
    "ply-1/4": { name: "1/4 in plywood", t: 0.25 },
    "mdf-3/4": { name: "3/4 in MDF", t: 0.75 },
  };
  const SHEET_SIZES = { "4x8": [48, 96], "2x4": [24, 48], "2x2": [24, 24] };
  const SHEET_SIZE_NAME = { "4x8": "4 × 8 ft sheet", "2x4": "2 × 4 ft project panel", "2x2": "2 × 2 ft project panel" };
  const KERF = 0.125;       // saw blade width allowed per cut
  const SNAP_END = 1.5;     // inches: a new end this close to an existing end joins it
  const SCREW_LENGTHS = [1.25, 1.625, 2, 2.5, 3, 3.5];
  const SCREWS_PER_LB = { 1.25: 220, 1.625: 170, 2: 130, 2.5: 95, 3: 70, 3.5: 55 };   // about, #8 / #10
  const AREAS = { "48x48": [48, 48], "96x48": [96, 48], "96x96": [96, 96], "192x96": [192, 96] };
  const VIEWS = { front: "Front", side: "Side", top: "Top" };

  // ---------- number helpers ----------
  function parseQty(raw) {
    const s = String(raw ?? "").trim().replace(/,/g, "").replace(/["″]$/, "");
    if (!s) return null;
    let m;
    if ((m = s.match(/^(\d+)(?:\s+|-)(\d+)\/(\d+)$/))) return +m[1] + +m[2] / +m[3];
    if ((m = s.match(/^(\d+)\/(\d+)$/))) return +m[2] ? +m[1] / +m[2] : NaN;
    if (/^(\d+\.?\d*|\.\d+)$/.test(s)) return parseFloat(s);
    return NaN;
  }
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  function inchFrac(inches) {
    const s16 = Math.round(inches * 16);
    const whole = Math.trunc(s16 / 16);
    const rem = s16 % 16;
    if (!rem) return `${whole}″`;
    const g = gcd(rem, 16);
    return `${whole ? whole + " " : ""}${rem / g}/${16 / g}″`;
  }
  function ftIn(inches) {
    const s16 = Math.round(inches * 16);
    const ft = Math.floor(s16 / 192);
    const rest = (s16 - ft * 192) / 16;
    return ft ? `${ft}′ ${inchFrac(rest)}` : inchFrac(rest);
  }
  const plainIn = (x) => inchFrac(x).replace("″", " in");
  const num = (x, d = 1) => Number(x).toLocaleString("en-US", { maximumFractionDigits: d });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const metric = () => (store.get("settings", {}) || {}).system === "metric";
  const mm = (inches) => (metric() ? ` (${num(inches * 25.4, 0)} mm)` : "");

  // ---------- project ----------
  const DEFAULT_SETTINGS = { profile: "2x4", sheet: "ply-3/4", fastener: "screws", area: "48x48", grid: 1, view: "front", tool: "board" };
  let nextId = 1;
  const newId = () => `p${nextId++}`;

  function chairExample() {
    const b = (view, profile, x1, y1, x2, y2, qty, name) => ({ id: newId(), kind: "board", view, profile, x1, y1, x2, y2, qty, name });
    return {
      settings: { ...DEFAULT_SETTINGS, profile: "2x2", area: "48x48", view: "side" },
      pieces: [
        // Front view: back legs for reference (counted in the side view), aprons and back slats between them
        b("front", "2x2", 12, 10, 12, 44, 0, "Back leg (counted in side view)"),
        b("front", "2x2", 28, 10, 28, 44, 0, "Back leg (counted in side view)"),
        b("front", "1x3", 12.75, 30, 27.25, 30, 2, "Front and back apron"),
        b("front", "1x3", 12.75, 14, 27.25, 14, 1, "Top back slat"),
        b("front", "1x3", 12.75, 20, 27.25, 20, 1, "Lower back slat"),
        // Side view: legs, side aprons and stretchers (two of each: left and right)
        b("side", "2x2", 12, 26.75, 12, 44, 2, "Front leg"),
        b("side", "2x2", 26, 10, 26, 44, 2, "Back leg"),
        b("side", "1x3", 12.75, 30, 25.25, 30, 2, "Side apron"),
        b("side", "1x2", 12.75, 38, 25.25, 38, 2, "Side stretcher"),
        // Top view: the seat
        { id: newId(), kind: "panel", view: "top", sheet: "ply-3/4", x: 11.25, y: 11.25, w: 17.5, h: 15.5, qty: 1, name: "Seat" },
      ],
    };
  }

  function validPiece(p) {
    if (!p || !VIEWS[p.view] || typeof p.qty !== "number") return false;
    if (p.kind === "board") return PROFILES[p.profile] && [p.x1, p.y1, p.x2, p.y2].every(isFinite);
    if (p.kind === "panel") return SHEETS[p.sheet] && [p.x, p.y, p.w, p.h].every(isFinite);
    return false;
  }
  function loadProject() {
    const saved = store.get("estimator");
    if (!saved || !Array.isArray(saved.pieces)) return chairExample();
    const s = { ...DEFAULT_SETTINGS, ...(saved.settings || {}) };
    if (!PROFILES[s.profile]) s.profile = DEFAULT_SETTINGS.profile;
    if (!SHEETS[s.sheet]) s.sheet = DEFAULT_SETTINGS.sheet;
    if (!AREAS[s.area]) s.area = DEFAULT_SETTINGS.area;
    if (!VIEWS[s.view]) s.view = "front";
    if (!["screws", "pocket"].includes(s.fastener)) s.fastener = "screws";
    if (![1, 0.5, 0.25].includes(+s.grid)) s.grid = 1;
    const pieces = saved.pieces.filter(validPiece).map((p) => ({ ...p, id: newId() }));
    return { settings: s, pieces };
  }
  let project = loadProject();
  const S = () => project.settings;
  let selectedId = null;
  const undoStack = [];

  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.set("estimator", project), 250);
  }
  function snapshot() {
    undoStack.push(JSON.stringify(project));
    if (undoStack.length > 60) undoStack.shift();
    $("undoBtn").disabled = false;
  }
  const byId = (id) => project.pieces.find((p) => p.id === id);
  const boardLen = (p) => Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
  const pieceLabel = (p) => (p.kind === "board" ? p.profile : SHEETS[p.sheet].name);
  const pieceSize = (p) => (p.kind === "board" ? ftIn(boardLen(p)) : `${inchFrac(p.w)} × ${inchFrac(p.h)}`);

  // ---------- geometry ----------
  function distToSeg(px, py, a) {
    const dx = a.x2 - a.x1, dy = a.y2 - a.y1;
    const L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - a.x1) * dx + (py - a.y1) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a.x1 + t * dx), py - (a.y1 + t * dy));
  }
  function segsCross(a, b) {
    const d = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const d1 = d(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1), d2 = d(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
    const d3 = d(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1), d4 = d(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
    return d1 * d2 < 0 && d3 * d4 < 0;
  }
  function touching(a, b) {
    const tol = 0.4 + (PROFILES[a.profile].t + PROFILES[b.profile].t) / 2;
    const ends = (p) => [[p.x1, p.y1], [p.x2, p.y2]];
    return ends(a).some(([x, y]) => distToSeg(x, y, b) <= tol) || ends(b).some(([x, y]) => distToSeg(x, y, a) <= tol) || segsCross(a, b);
  }

  // ---------- estimate ----------
  // Best-fit decreasing for every stock length, then each board is trimmed to the shortest length that holds its cuts.
  function packBoards(items, stock) {
    const sorted = [...items].sort((a, b) => b.len - a.len);
    let best = null;
    for (const cap of stock) {
      if (sorted[0].len > cap + 1e-9) continue;
      const bins = [];
      for (const it of sorted) {
        let pick = null, left = Infinity;
        for (const b of bins) {
          const rem = cap - (b.used + KERF + it.len);
          if (rem >= -1e-9 && rem < left) { left = rem; pick = b; }
        }
        if (!pick) { pick = { used: -KERF, cuts: [] }; bins.push(pick); }
        pick.used += KERF + it.len;
        pick.cuts.push(it);
      }
      bins.forEach((b) => { b.stock = stock.find((s) => s >= b.used - 1e-9); });
      const total = bins.reduce((s, b) => s + b.stock, 0);
      if (!best || total < best.total - 1e-9 || (Math.abs(total - best.total) < 1e-9 && bins.length < best.bins.length)) best = { total, bins };
    }
    return best;
  }

  // Shelf packing on a 4 × 8 sheet; a sheet whose cuts fit a project panel is bought as that panel instead.
  function packSheets(items) {
    const [SW, SH] = SHEET_SIZES["4x8"];
    const parts = items.map((it) => {
      let w = Math.min(it.w, it.h), h = Math.max(it.w, it.h);   // long side runs down the 8 ft length
      if (w > SW) [w, h] = [h, w];
      return { ...it, w, h };
    }).sort((a, b) => b.h - a.h || b.w - a.w);
    const sheets = [];
    for (const p of parts) {
      let placed = false;
      for (const sh of sheets) {
        for (const shelf of sh.shelves) {
          if (shelf.x + p.w <= SW + 1e-9 && p.h <= shelf.h + 1e-9) {
            sh.cuts.push({ ...p, x: shelf.x, y: shelf.y });
            shelf.x += p.w + KERF;
            placed = true;
            break;
          }
        }
        if (placed) break;
        if (sh.nextY + p.h <= SH + 1e-9) {
          sh.shelves.push({ y: sh.nextY, h: p.h, x: p.w + KERF });
          sh.cuts.push({ ...p, x: 0, y: sh.nextY });
          sh.nextY += p.h + KERF;
          placed = true;
          break;
        }
      }
      if (!placed) sheets.push({ shelves: [{ y: 0, h: p.h, x: p.w + KERF }], cuts: [{ ...p, x: 0, y: 0 }], nextY: p.h + KERF });
    }
    return sheets.map((sh) => {
      const maxX = Math.max(...sh.cuts.map((c) => c.x + c.w));
      const maxY = Math.max(...sh.cuts.map((c) => c.y + c.h));
      const size = maxX <= 24 && maxY <= 24 ? "2x2" : maxX <= 24 && maxY <= 48 ? "2x4" : "4x8";
      return { size, cuts: sh.cuts };
    });
  }

  const screwLength = (need) => SCREW_LENGTHS.find((s) => s >= need - 0.01) || 3.5;

  function estimate() {
    const warnings = [];
    const counted = project.pieces.filter((p) => p.qty > 0);
    // lumber
    const byProfile = {};
    for (const p of counted.filter((x) => x.kind === "board")) {
      const prof = PROFILES[p.profile];
      const max = prof.lengths[prof.lengths.length - 1] * 12;
      let len = boardLen(p);
      if (len < 0.25) continue;
      let parts = 1;
      if (len > max) {
        parts = Math.ceil(len / max);
        warnings.push(`${p.name || p.profile} is ${ftIn(len)}, longer than the longest ${p.profile} (${max / 12} ft). It is split into ${parts} pieces that need joining.`);
        len /= parts;
      }
      for (let i = 0; i < p.qty * parts; i++) (byProfile[p.profile] ??= []).push({ len, name: p.name || p.profile });
    }
    const lumber = Object.entries(byProfile).map(([profile, items]) => {
      const plan = packBoards(items, PROFILES[profile].lengths.map((f) => f * 12));
      const counts = {};
      plan.bins.forEach((b) => { counts[b.stock] = (counts[b.stock] || 0) + 1; });
      return { profile, plan, counts, cutTotal: items.reduce((s, i) => s + i.len, 0) };
    }).sort((a, b) => Object.keys(PROFILES).indexOf(a.profile) - Object.keys(PROFILES).indexOf(b.profile));

    // sheets
    const bySheet = {};
    for (const p of counted.filter((x) => x.kind === "panel")) {
      if (Math.min(p.w, p.h) > 48 || Math.max(p.w, p.h) > 96) {
        warnings.push(`${p.name || "A sheet piece"} (${pieceSize(p)}) is bigger than a 4 × 8 ft sheet. Split it into smaller pieces.`);
        continue;
      }
      for (let i = 0; i < p.qty; i++) (bySheet[p.sheet] ??= []).push({ w: p.w, h: p.h, name: p.name || SHEETS[p.sheet].name });
    }
    const sheets = Object.entries(bySheet).map(([sheet, items]) => {
      const layout = packSheets(items);
      const counts = {};
      layout.forEach((l) => { counts[l.size] = (counts[l.size] || 0) + 1; });
      return { sheet, layout, counts };
    });

    // joints and screws
    const pocket = S().fastener === "pocket";
    const screws = {};
    const addScrews = (key, label, n, perBox, boxLabel) => {
      const s = (screws[key] ??= { label, n: 0, perBox, boxLabel });
      s.n += n;
    };
    let joints = 0;
    for (const view of Object.keys(VIEWS)) {
      const boards = project.pieces.filter((p) => p.view === view && p.kind === "board");
      for (let i = 0; i < boards.length; i++) {
        for (let j = i + 1; j < boards.length; j++) {
          const a = boards[i], b = boards[j];
          const mult = Math.max(a.qty, b.qty);
          if (!mult || !touching(a, b)) continue;
          joints += mult;
          const pa = PROFILES[a.profile], pb = PROFILES[b.profile];
          const [thin, thick] = pa.t < pb.t || (pa.t === pb.t && pa.w <= pb.w) ? [pa, pb] : [pb, pa];
          if (pocket) {
            const len = thin.t <= 0.75 ? 1.25 : 2.5;
            addScrews(`pocket-${len}`, `Pocket-hole screws, ${plainIn(len)}`, mult * (thin.w >= 5.5 ? 3 : 2), 100, "box of 100");
          } else {
            const len = screwLength(thin.t + Math.min(thick.t * 2 / 3, 1.25));
            const per = thin.w <= 3.5 ? 2 : thin.w <= 7.25 ? 3 : 4;
            addScrews(`wood-${len}`, `${len >= 3 ? "#10" : "#8"} wood screws, ${plainIn(len)}`, mult * per, SCREWS_PER_LB[len], "1 lb box");
          }
        }
      }
    }
    for (const p of counted.filter((x) => x.kind === "panel")) {
      const len = screwLength(SHEETS[p.sheet].t + 0.875);
      addScrews(`wood-${len}`, `#8 wood screws, ${plainIn(len)}`, Math.ceil((2 * (p.w + p.h)) / 8) * p.qty, SCREWS_PER_LB[len], "1 lb box");
    }
    const screwList = Object.values(screws).map((s) => {
      const need = Math.ceil(s.n * 1.1);   // 10% spare
      return { ...s, need, boxes: Math.ceil(need / s.perBox) };
    });

    const stockTotal = lumber.reduce((s, l) => s + l.plan.total, 0);
    const cutTotal = lumber.reduce((s, l) => s + l.cutTotal, 0);
    const boardFeet = lumber.reduce((s, l) => {
      const [nt, nw] = l.profile.split("x").map(Number);
      return s + nt * nw * (l.plan.total / 12) / 12;
    }, 0);
    return {
      lumber, sheets, screwList, joints, warnings, boardFeet,
      waste: stockTotal ? (stockTotal - cutTotal - KERF * 0) / stockTotal * 100 : 0,
      cuts: counted.reduce((s, p) => s + p.qty, 0),
    };
  }

  // ---------- canvas ----------
  const svg = $("canvas");
  const SVGNS = "http://www.w3.org/2000/svg";
  let drag = null;        // { start, cur, mode: "drag" | "click" }
  let snapPoint = null;

  function area() { return AREAS[S().area]; }
  function viewPieces() { return project.pieces.filter((p) => p.view === S().view); }

  function toInches(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }
  function snap(p) {
    const [W, H] = area();
    snapPoint = null;
    let best = SNAP_END;
    for (const q of viewPieces()) {
      const pts = q.kind === "board" ? [[q.x1, q.y1], [q.x2, q.y2]] : [[q.x, q.y], [q.x + q.w, q.y], [q.x, q.y + q.h], [q.x + q.w, q.y + q.h]];
      for (const [x, y] of pts) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < best) { best = d; snapPoint = { x, y }; }
      }
    }
    if (snapPoint) return { ...snapPoint };
    const g = +S().grid;
    return { x: Math.max(0, Math.min(W, Math.round(p.x / g) * g)), y: Math.max(0, Math.min(H, Math.round(p.y / g) * g)) };
  }

  function el(tag, attrs, text) {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  }

  function renderCanvas() {
    const [W, H] = area();
    const M = Math.max(W, H);
    const fs = M / 40;
    const pad = fs * 2.2;
    svg.setAttribute("viewBox", `${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`);
    svg.dataset.tool = S().tool;
    svg.replaceChildren();
    // grid: inch lines (or every 2 or 6 in on big areas), foot lines heavier, foot marks along the edges
    const minor = W <= 48 ? 1 : W <= 96 ? 2 : 6;
    let dMinor = "", dMajor = "";
    for (let x = 0; x <= W + 1e-9; x += minor) (x % 12 === 0 ? (dMajor += `M${x} 0V${H}`) : (dMinor += `M${x} 0V${H}`));
    for (let y = 0; y <= H + 1e-9; y += minor) (y % 12 === 0 ? (dMajor += `M0 ${y}H${W}`) : (dMinor += `M0 ${y}H${W}`));
    svg.append(el("path", { d: dMinor, class: "grid-minor", "stroke-width": M / 900 }), el("path", { d: dMajor, class: "grid-major", "stroke-width": M / 450 }));
    for (let x = 12; x <= W; x += 12) svg.append(el("text", { x, y: -fs * 0.6, "font-size": fs * 0.8, "text-anchor": "middle", class: "grid-label" }, `${x / 12}′`));
    for (let y = 12; y <= H; y += 12) svg.append(el("text", { x: -fs * 0.5, y: y + fs * 0.3, "font-size": fs * 0.8, "text-anchor": "end", class: "grid-label" }, `${y / 12}′`));

    const pieces = viewPieces();
    const labels = [];
    for (const p of pieces.filter((q) => q.kind === "panel")) {
      const cls = `panel${p.qty ? "" : " ref"}${p.id === selectedId ? " sel" : ""}`;
      svg.append(el("rect", { x: p.x, y: p.y, width: p.w, height: p.h, class: cls, "stroke-width": M / 300 }));
      svg.append(el("rect", { x: p.x, y: p.y, width: p.w, height: p.h, class: "hit", "data-id": p.id }));
      labels.push({ x: p.x + p.w / 2, y: p.y + p.h / 2 + fs * 0.35, text: `${inchFrac(p.w)} × ${inchFrac(p.h)}${p.qty > 1 ? ` ×${p.qty}` : p.qty ? "" : " ref"}`, sel: p.id === selectedId });
    }
    for (const p of pieces.filter((q) => q.kind === "board")) {
      const prof = PROFILES[p.profile];
      const cls = `piece${p.qty ? "" : " ref"}${p.id === selectedId ? " sel" : ""}`;
      const attrs = { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, class: cls, "stroke-width": Math.max(prof.t, M / 160) };
      if (!p.qty) attrs["stroke-dasharray"] = `${M / 60} ${M / 120}`;
      svg.append(el("line", attrs));
      svg.append(el("line", { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, class: "hit", "stroke-width": Math.max(prof.t, M / 25), "data-id": p.id }));
      const len = boardLen(p);
      const nx = -(p.y2 - p.y1) / (len || 1), ny = (p.x2 - p.x1) / (len || 1);
      // upright pieces get their label beside them, flat ones above or below
      const upright = Math.abs(nx) > 0.7;
      const off = prof.t / 2 + fs * (upright ? 0.5 : 0.9);
      labels.push({ x: (p.x1 + p.x2) / 2 + nx * off, y: (p.y1 + p.y2) / 2 + ny * off + fs * 0.35,
        anchor: upright ? (nx < 0 ? "end" : "start") : "middle",
        text: `${inchFrac(len)}${p.qty > 1 ? ` ×${p.qty}` : p.qty ? "" : " ref"}`, sel: p.id === selectedId });
    }
    for (const l of labels) {
      svg.append(el("text", { x: l.x, y: l.y, "font-size": fs, "text-anchor": l.anchor || "middle", class: `dim${l.sel ? " sel" : ""}`, "stroke-width": fs / 4, "pointer-events": "none" }, l.text));
    }
    // drawing preview
    if (drag && drag.cur) {
      const a = drag.start, b = drag.cur;
      if (S().tool === "board") {
        svg.append(el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "preview", "stroke-width": Math.max(PROFILES[S().profile].t, M / 160) }));
        svg.append(el("text", { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - fs, "font-size": fs, "text-anchor": "middle", class: "dim sel", "stroke-width": fs / 4 }, inchFrac(Math.hypot(b.x - a.x, b.y - a.y))));
      } else {
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
        svg.append(el("rect", { x, y, width: w, height: h, class: "preview", "stroke-width": M / 300 }));
        svg.append(el("text", { x: x + w / 2, y: y + h / 2, "font-size": fs, "text-anchor": "middle", class: "dim sel", "stroke-width": fs / 4 }, `${inchFrac(w)} × ${inchFrac(h)}`));
      }
      svg.append(el("circle", { cx: a.x, cy: a.y, r: M / 140, class: "snap-dot" }));
    }
    if (snapPoint && drag) svg.append(el("circle", { cx: snapPoint.x, cy: snapPoint.y, r: M / 90, class: "snap-dot", "fill-opacity": 0.5 }));

    const counted = pieces.filter((p) => p.qty > 0).length;
    $("canvasLabel").textContent = `${VIEWS[S().view]} view sketch, ${W / 12} by ${H / 12} feet, with ${pieces.length} piece${pieces.length === 1 ? "" : "s"} (${counted} counted). The piece list below describes every piece.`;
  }

  function addPiece(piece) {
    snapshot();
    project.pieces.push(piece);
    selectedId = piece.id;
    changed();
    renderEditor();
    announce(`Added ${pieceLabel(piece)}, ${pieceSize(piece)}${piece.view !== S().view ? `, in the ${piece.view} view` : ""}`);
  }

  function finishDrawing(a, b) {
    if (S().tool === "board") {
      if (Math.hypot(b.x - a.x, b.y - a.y) < 0.5) return;
      addPiece({ id: newId(), kind: "board", view: S().view, profile: S().profile, x1: a.x, y1: a.y, x2: b.x, y2: b.y, qty: 1, name: "" });
    } else {
      const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
      if (w < 1 || h < 1) return;
      addPiece({ id: newId(), kind: "panel", view: S().view, sheet: S().sheet, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w, h, qty: 1, name: "" });
    }
  }

  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (S().tool === "select") {
      const id = e.target.closest("[data-id]")?.dataset.id || null;
      select(id);
      return;
    }
    e.preventDefault();
    const p = snap(toInches(e));
    if (drag && drag.mode === "click") {        // second tap of a tap-tap line
      const start = drag.start;
      drag = null;
      finishDrawing(start, p);
      return;
    }
    drag = { start: p, cur: p, mode: "drag", moved: false };
    svg.setPointerCapture?.(e.pointerId);
    renderCanvas();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = snap(toInches(e));
    if (p.x !== drag.cur.x || p.y !== drag.cur.y) {
      drag.cur = p;
      if (drag.mode === "drag" && (p.x !== drag.start.x || p.y !== drag.start.y)) drag.moved = true;
      renderCanvas();
    }
  });
  svg.addEventListener("pointerup", (e) => {
    if (!drag || drag.mode !== "drag") return;
    const p = snap(toInches(e));
    if (!drag.moved && p.x === drag.start.x && p.y === drag.start.y) {
      drag.mode = "click";                       // waiting for the second tap
      announce("Start point set. Tap the end point.");
      return;
    }
    const start = drag.start;
    drag = null;
    snapPoint = null;
    finishDrawing(start, p);
  });
  svg.addEventListener("pointercancel", () => { drag = null; snapPoint = null; renderCanvas(); });

  // keyboard on the focused sketch (shortcuts only act while the sketch has focus)
  svg.addEventListener("keydown", (e) => {
    const list = viewPieces();
    if (e.key === "Escape") { drag = null; snapPoint = null; select(null); return; }
    if (e.key === "[" || e.key === "]") {
      e.preventDefault();
      if (!list.length) return;
      const i = list.findIndex((p) => p.id === selectedId);
      const n = e.key === "]" ? (i + 1) % list.length : (i <= 0 ? list.length - 1 : i - 1);
      select(list[n].id);
      const p = list[n];
      announce(`${p.name || pieceLabel(p)}, ${pieceSize(p)}, quantity ${p.qty}`);
      return;
    }
    const p = byId(selectedId);
    if (!p || p.view !== S().view) return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removePiece(p.id); return; }
    const step = (+S().grid) * (e.shiftKey ? 12 : 1);
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!mv) return;
    e.preventDefault();
    snapshot();
    if (p.kind === "board") { p.x1 += mv[0]; p.x2 += mv[0]; p.y1 += mv[1]; p.y2 += mv[1]; } else { p.x += mv[0]; p.y += mv[1]; }
    changed();
  });

  // ---------- selected piece editor ----------
  function select(id) {
    selectedId = id;
    const p = byId(id);
    if (p && p.view !== S().view) { S().view = p.view; renderViews(); }
    renderCanvas();
    renderTable();
    renderEditor();
  }

  function renderEditor() {
    const p = byId(selectedId);
    $("editor").hidden = !p;
    if (!p) return;
    $("editorTitle").textContent = p.kind === "board" ? "Selected board" : "Selected sheet piece";
    const matOptions = p.kind === "board"
      ? Object.keys(PROFILES).map((k) => `<option value="${k}" ${k === p.profile ? "selected" : ""}>${k}</option>`).join("")
      : Object.entries(SHEETS).map(([k, s]) => `<option value="${k}" ${k === p.sheet ? "selected" : ""}>${s.name}</option>`).join("");
    const size = p.kind === "board"
      ? `<div class="opt"><label for="edLen">Length (in)</label><input id="edLen" type="text" inputmode="decimal" autocomplete="off" value="${esc(inchFrac(boardLen(p)).replace("″", ""))}"></div>`
      : `<div class="opt"><label for="edW">Width (in)</label><input id="edW" type="text" inputmode="decimal" autocomplete="off" value="${esc(inchFrac(p.w).replace("″", ""))}"></div>
         <div class="opt"><label for="edH">Height (in)</label><input id="edH" type="text" inputmode="decimal" autocomplete="off" value="${esc(inchFrac(p.h).replace("″", ""))}"></div>`;
    $("editorFields").innerHTML = `
      <div class="opt"><label for="edName">Name</label><input id="edName" type="text" autocomplete="off" value="${esc(p.name || "")}" placeholder="e.g. Front leg"></div>
      <div class="opt"><label for="edMat">Material</label><select id="edMat">${matOptions}</select></div>
      ${size}
      <div class="opt"><label for="edQty">Qty (0 = reference)</label><input id="edQty" type="number" min="0" max="999" step="1" value="${p.qty}"></div>
      <button type="button" class="del-btn" id="edDelete">Delete piece</button>`;
  }

  $("editorFields").addEventListener("change", (e) => {
    const p = byId(selectedId);
    if (!p) return;
    const t = e.target;
    snapshot();
    if (t.id === "edName") p.name = t.value.trim().slice(0, 60);
    if (t.id === "edMat") { if (p.kind === "board") p.profile = t.value; else p.sheet = t.value; }
    if (t.id === "edQty") p.qty = Math.max(0, Math.min(999, Math.round(+t.value || 0)));
    if (t.id === "edLen") {
      const L = parseQty(t.value);
      if (!(L > 0)) { t.setAttribute("aria-invalid", "true"); announce("Enter a length like 17 1/2"); undoStack.pop(); return; }
      t.removeAttribute("aria-invalid");
      const cur = boardLen(p) || 1;
      const ux = (p.x2 - p.x1) / cur || 1, uy = (p.y2 - p.y1) / cur || 0;
      p.x2 = p.x1 + ux * L; p.y2 = p.y1 + uy * L;
    }
    if (t.id === "edW" || t.id === "edH") {
      const v = parseQty(t.value);
      if (!(v > 0)) { t.setAttribute("aria-invalid", "true"); announce("Enter a size like 15 1/2"); undoStack.pop(); return; }
      t.removeAttribute("aria-invalid");
      if (t.id === "edW") p.w = v; else p.h = v;
    }
    changed();
  });
  $("editorFields").addEventListener("click", (e) => { if (e.target.id === "edDelete") removePiece(selectedId); });

  function removePiece(id) {
    const p = byId(id);
    if (!p) return;
    snapshot();
    project.pieces = project.pieces.filter((q) => q.id !== id);
    selectedId = null;
    changed();
    renderEditor();
    announce(`Deleted ${p.name || pieceLabel(p)}`);
    svg.focus();
  }

  // ---------- piece list ----------
  function renderTable() {
    const rows = [...project.pieces].sort((a, b) => Object.keys(VIEWS).indexOf(a.view) - Object.keys(VIEWS).indexOf(b.view));
    $("pieceRows").innerHTML = rows.length ? rows.map((p) => `
      <tr class="${p.id === selectedId ? "sel" : ""}">
        <td data-label="View">${VIEWS[p.view]}</td>
        <td data-label="Name">${esc(p.name || "—")}</td>
        <td data-label="Material">${esc(pieceLabel(p))}</td>
        <td class="num" data-label="Size">${esc(pieceSize(p))}</td>
        <td class="num" data-label="Qty">${p.qty || "0 (ref)"}</td>
        <td class="actions-cell"><div class="row-actions">
          <button type="button" class="text-btn" data-edit="${p.id}" aria-label="Edit ${esc(p.name || pieceLabel(p))}, ${esc(pieceSize(p))}">Edit</button>
          <button type="button" class="text-btn del" data-del="${p.id}" aria-label="Delete ${esc(p.name || pieceLabel(p))}, ${esc(pieceSize(p))}">Delete</button>
        </div></td>
      </tr>`).join("") : `<tr class="empty-row"><td colspan="6">No pieces yet. Draw one on the sketch or add one below.</td></tr>`;
  }
  $("pieceRows").addEventListener("click", (e) => {
    const ed = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    if (ed) {
      select(ed.dataset.edit);
      $("editor").scrollIntoView({ block: "nearest" });
      $("edName").focus();
    }
    if (del) removePiece(del.dataset.del);
  });

  // add without drawing: placed in an empty band of the chosen view
  function fillAddMaterials() {
    const kind = $("addKind").value;
    $("addMat").innerHTML = kind === "board"
      ? Object.keys(PROFILES).map((k) => `<option value="${k}" ${k === S().profile ? "selected" : ""}>${k}</option>`).join("")
      : Object.entries(SHEETS).map(([k, s]) => `<option value="${k}" ${k === S().sheet ? "selected" : ""}>${s.name}</option>`).join("");
    document.querySelectorAll("#addForm [data-for]").forEach((n) => { n.hidden = n.dataset.for !== kind; });
  }
  $("addKind").addEventListener("change", fillAddMaterials);
  $("addForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const kind = $("addKind").value;
    const qty = Math.max(0, Math.min(999, Math.round(+$("addQty").value || 0)));
    const view = $("addView").value;
    const [W, H] = area();
    const used = project.pieces.filter((p) => p.view === view).map((p) => (p.kind === "board" ? Math.max(p.y1, p.y2) : p.y + p.h));
    const y = Math.min(H - 1, (used.length ? Math.max(...used) : 0) + 3);
    $("addErr").textContent = "";
    if (kind === "board") {
      const L = parseQty($("addLen").value);
      if (!(L > 0)) { $("addErr").textContent = "Enter a length like 24 or 17 1/2."; $("addLen").focus(); return; }
      if (L > W) S().area = L > 96 ? "192x96" : "96x96";
      addPiece({ id: newId(), kind, view, profile: $("addMat").value, x1: 2, y1: y, x2: 2 + L, y2: y, qty, name: "" });
    } else {
      const w = parseQty($("addW").value), h = parseQty($("addH").value);
      if (!(w > 0) || !(h > 0)) { $("addErr").textContent = "Enter a width and height like 16 or 15 1/2."; return; }
      addPiece({ id: newId(), kind, view, sheet: $("addMat").value, x: 2, y: Math.min(y, Math.max(0, H - h)), w, h, qty, name: "" });
    }
    renderControls();
  });

  // ---------- estimate panel ----------
  let lastText = "";
  function renderEstimate() {
    const r = estimate();
    const box = $("estimate");
    const lines = [];
    const rows = [];
    for (const l of r.lumber) {
      const prof = PROFILES[l.profile];
      for (const [len, n] of Object.entries(l.counts).sort((a, b) => a[0] - b[0])) {
        rows.push(`<tr><td>${l.profile} × ${len / 12} ft<span class="sub">actual ${plainIn(prof.t)} × ${plainIn(prof.w)}${mm(len)}</span></td><td class="qty">${n}</td></tr>`);
        lines.push(`${l.profile} x ${len / 12} ft: ${n}`);
      }
    }
    for (const s of r.sheets) {
      for (const size of ["4x8", "2x4", "2x2"]) {
        const n = s.counts[size];
        if (!n) continue;
        rows.push(`<tr><td>${SHEETS[s.sheet].name}<span class="sub">${SHEET_SIZE_NAME[size]}</span></td><td class="qty">${n}</td></tr>`);
        lines.push(`${SHEETS[s.sheet].name}, ${SHEET_SIZE_NAME[size]}: ${n}`);
      }
    }
    for (const s of r.screwList) {
      rows.push(`<tr><td>${esc(s.label)}<span class="sub">${s.need} with 10% spare · ${s.boxLabel} has about ${s.perBox}</span></td><td class="qty">${s.boxes} ${s.boxes === 1 ? "box" : "boxes"}</td></tr>`);
      lines.push(`${s.label}: ${s.need} (${s.boxes} x ${s.boxLabel})`);
    }
    if (r.joints) {
      rows.push(`<tr><td>Wood glue<span class="sub">8 oz bottle, for stronger joints</span></td><td class="qty">1</td></tr>`);
      lines.push("Wood glue, 8 oz: 1");
    }
    if (!rows.length) {
      box.innerHTML = `<div><div class="primary-label" id="buyTitle">Shopping list</div><p class="est-empty">Draw a board or a sheet to see what to buy. Pieces with quantity 0 are for reference and aren't counted.</p></div>`;
      lastText = "";
      store.set("estimate", null);
      return;
    }
    const bars = r.lumber.map((l) => `
      <h3 class="plan-h">${l.profile}</h3>
      ${l.plan.bins.map((b, i) => `
        <div class="board-bar">
          <span class="bar-label">Board ${i + 1}: ${b.stock / 12} ft · ${ftIn(b.stock - b.used)} left over</span>
          <div class="bar" role="img" aria-label="${l.profile} board ${i + 1}, ${b.stock / 12} feet: cuts ${b.cuts.map((c) => `${esc(c.name)} ${ftIn(c.len)}`).join(", ")}">
            ${b.cuts.map((c) => `<span class="cut" style="flex: 0 0 ${(c.len / b.stock) * 100}%" title="${esc(c.name)} ${ftIn(c.len)}">${inchFrac(c.len)}</span>`).join("")}
            <span class="waste"></span>
          </div>
        </div>`).join("")}`).join("");
    const sheetPlans = r.sheets.map((s) => s.layout.map((l, i) => {
      const [w, h] = SHEET_SIZES[l.size];
      return `<div class="sheet-plan">
        <svg viewBox="-1 -1 ${w + 2} ${h + 2}" role="img" aria-label="${SHEETS[s.sheet].name} ${SHEET_SIZE_NAME[l.size]} ${i + 1}: ${l.cuts.map((c) => `${esc(c.name)} ${inchFrac(c.w)} by ${inchFrac(c.h)}`).join(", ")}">
          <rect class="sheet-bg" x="0" y="0" width="${w}" height="${h}" stroke-width="0.8"/>
          ${l.cuts.map((c) => `<rect class="sheet-cut" x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}"/>`).join("")}
        </svg>
        <span>${SHEETS[s.sheet].name.replace(" plywood", " ply")}, ${l.size.replace("x", "×")}</span>
      </div>`;
    }).join("")).join("");

    box.innerHTML = `
      <div>
        <div class="primary-label" id="buyTitle">Shopping list</div>
        <table class="buy-table"><thead><tr><th scope="col">Item</th><th scope="col" style="text-align:right">Buy</th></tr></thead><tbody>${rows.join("")}</tbody></table>
      </div>
      <dl class="facts">
        <div><dt>Pieces to cut</dt><dd>${r.cuts}</dd></div>
        <div><dt>Joints</dt><dd>${r.joints}</dd></div>
        <div><dt>Board feet</dt><dd>${num(r.boardFeet, 1)}</dd></div>
        <div><dt>Lumber left over</dt><dd>${num(r.waste, 0)}%</dd></div>
      </dl>
      ${r.warnings.length ? `<ul class="warn-list">${r.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
      ${bars ? `<div class="plan"><div class="primary-label">Cut plan</div>${bars}</div>` : ""}
      ${sheetPlans ? `<div class="plan"><div class="primary-label">Sheet layout</div><div class="sheet-plans">${sheetPlans}</div></div>` : ""}
      <div class="result-foot">
        <p class="note">Stock sizes common at Home Depot and Lowe's; lengths vary by store. Allows ${plainIn(KERF)} per saw cut. Screw counts assume ${S().fastener === "pocket" ? "pocket-hole joints" : "screwed butt joints"} wherever pieces meet.</p>
        <button type="button" class="copy-btn" id="copyList">Copy list</button>
      </div>`;
    lastText = "Shopping list\n" + lines.join("\n");
    store.set("estimate", { lines, at: Date.now() });
    clearTimeout(srTimer);
    srTimer = setTimeout(() => { $("srStatus").textContent = `Estimate updated: ${lines.slice(0, 4).join("; ")}${lines.length > 4 ? ", and more" : ""}`; }, 900);
  }
  let srTimer;
  $("estimate").addEventListener("click", async (e) => {
    const b = e.target.closest("#copyList");
    if (!b || !lastText) return;
    try { await navigator.clipboard.writeText(lastText); b.textContent = "Copied"; }
    catch { b.textContent = "Copy blocked: select the list instead"; }
    setTimeout(() => { if (b.isConnected) b.textContent = "Copy list"; }, 1800);
  });

  // ---------- controls ----------
  function renderViews() {
    document.querySelectorAll("[data-view]").forEach((b) => {
      const on = b.dataset.view === S().view;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
  }
  function renderControls() {
    renderViews();
    document.querySelectorAll("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tool === S().tool ? "true" : "false"));
    $("newProfile").innerHTML = Object.entries(PROFILES).map(([k, p]) => `<option value="${k}" ${k === S().profile ? "selected" : ""}>${k} (${plainIn(p.t)} × ${plainIn(p.w)})</option>`).join("");
    $("newSheet").innerHTML = Object.entries(SHEETS).map(([k, s]) => `<option value="${k}" ${k === S().sheet ? "selected" : ""}>${s.name}</option>`).join("");
    $("areaSel").value = S().area;
    $("gridSel").value = String(S().grid);
    document.querySelectorAll('input[name="fastener"]').forEach((r) => { r.checked = r.value === S().fastener; });
  }

  let frame = 0;
  function changed() {
    save();
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      renderCanvas();
      renderTable();
      renderEstimate();
    });
  }
  function renderAll() {
    renderControls();
    renderCanvas();
    renderTable();
    renderEditor();
    renderEstimate();
    fillAddMaterials();
    $("undoBtn").disabled = !undoStack.length;
  }

  const views = [...document.querySelectorAll("[data-view]")];
  views.forEach((b) => b.addEventListener("click", () => {
    S().view = b.dataset.view;
    drag = null;
    if (byId(selectedId)?.view !== S().view) { selectedId = null; renderEditor(); }
    renderViews();
    changed();
  }));
  $("view-front").parentElement.addEventListener("keydown", (e) => {   // arrow keys move between view tabs
    const i = views.findIndex((b) => b.dataset.view === S().view);
    const n = e.key === "ArrowRight" ? (i + 1) % views.length : e.key === "ArrowLeft" ? (i + views.length - 1) % views.length : -1;
    if (n < 0) return;
    e.preventDefault();
    views[n].click();
    views[n].focus();
  });
  document.querySelectorAll("[data-tool]").forEach((b) => b.addEventListener("click", () => {
    S().tool = b.dataset.tool;
    drag = null;
    renderControls();
    changed();
  }));
  $("newProfile").addEventListener("change", (e) => { S().profile = e.target.value; save(); fillAddMaterials(); });
  $("newSheet").addEventListener("change", (e) => { S().sheet = e.target.value; save(); fillAddMaterials(); });
  $("areaSel").addEventListener("change", (e) => { S().area = e.target.value; changed(); });
  $("gridSel").addEventListener("change", (e) => { S().grid = +e.target.value; save(); });

  $("undoBtn").addEventListener("click", () => {
    const prev = undoStack.pop();
    if (!prev) return;
    project = JSON.parse(prev);
    if (!byId(selectedId)) selectedId = null;
    save();
    renderAll();
    announce("Undone");
  });

  // inline confirmation for replacing the sketch
  let pendingConfirm = null;
  function askConfirm(text, action) {
    if (!project.pieces.length) { action(); return; }
    pendingConfirm = action;
    $("confirmText").textContent = text;
    $("confirmBar").hidden = false;
    $("confirmNo").focus();
  }
  $("confirmYes").addEventListener("click", () => {
    $("confirmBar").hidden = true;
    const a = pendingConfirm;
    pendingConfirm = null;
    if (a) a();
  });
  $("confirmNo").addEventListener("click", () => { $("confirmBar").hidden = true; pendingConfirm = null; $("clearBtn").focus(); });
  $("exampleBtn").addEventListener("click", () => askConfirm("Replace your sketch with the example chair?", () => {
    snapshot();
    project = chairExample();
    selectedId = null;
    save();
    renderAll();
    announce("Example chair loaded");
  }));
  $("clearBtn").addEventListener("click", () => askConfirm("Delete every piece and start a new sketch?", () => {
    snapshot();
    project.pieces = [];
    selectedId = null;
    save();
    renderAll();
    announce("Sketch cleared");
  }));

  function announce(text) { $("srStatus").textContent = text; }

  // ---------- theme and settings dialog ----------
  const dialog = $("settingsDialog");
  theme.render($("themePanel"));
  $("openSettings").addEventListener("click", () => {
    renderControls();
    dialog.showModal();
    dialog.querySelector('input[name="t-mode"]:checked')?.focus();
  });
  $("closeSettings").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => { $("resetConfirm").hidden = true; $("resetBtn").hidden = false; $("openSettings").focus(); });
  dialog.addEventListener("change", (e) => {
    if (e.target.name === "fastener") { S().fastener = e.target.value; changed(); }
  });
  $("resetBtn").addEventListener("click", () => { $("resetConfirm").hidden = false; $("resetBtn").hidden = true; $("resetNo").focus(); });
  $("resetNo").addEventListener("click", () => { $("resetConfirm").hidden = true; $("resetBtn").hidden = false; $("resetBtn").focus(); });
  $("resetYes").addEventListener("click", () => {
    theme.reset();
    project.settings = { ...DEFAULT_SETTINGS };
    if ($("resetData").checked) { project.pieces = []; selectedId = null; }
    $("resetData").checked = false;
    save();
    renderAll();
    $("resetConfirm").hidden = true;
    $("resetBtn").hidden = false;
    $("resetBtn").focus();
    announce("Default settings restored");
  });

  // another tab changed the sketch
  store.onChange("estimator", () => { project = loadProject(); selectedId = null; renderAll(); });

  // ---------- install and offline ----------
  let installEvent = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvent = e; $("installBtn").hidden = false; });
  $("installBtn").addEventListener("click", async () => {
    if (!installEvent) return;
    installEvent.prompt();
    try { await installEvent.userChoice; } catch { /* dismissed */ }
    installEvent = null;
    $("installBtn").hidden = true;
  });
  window.addEventListener("appinstalled", () => { $("installBtn").hidden = true; });
  let offlineTimer;
  function showOffline() {
    const note = $("offlineNote");
    clearTimeout(offlineTimer);
    note.textContent = navigator.onLine ? "Back online." : "You're offline. Everything still works.";
    note.hidden = false;
    offlineTimer = setTimeout(() => { note.hidden = true; }, navigator.onLine ? 2500 : 5000);
  }
  window.addEventListener("offline", showOffline);
  window.addEventListener("online", showOffline);
  if ("serviceWorker" in navigator && (location.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("../sw.js", { scope: "../" }).catch(() => { /* not available here */ });
    });
  }
  window.addEventListener("pagehide", () => { clearTimeout(saveTimer); store.set("estimator", project); });

  renderAll();
})();
