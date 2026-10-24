(() => {
  "use strict";

  // ---------- units (everything is worked out in metres, m², m³, kg, Pa) ----------
  const IN = 0.0254, FT = 0.3048, FT3 = 0.0283168, YD3 = 0.764555, GAL = 0.00378541, LB = 0.453592;

  // ---------- number helpers ----------
  function parseQty(raw) {
    if (raw == null) return null;
    const s = String(raw).trim().replace(/,/g, "");
    if (s === "") return null;
    let m;
    if ((m = s.match(/^(-?\d+)(?:\s+|-)(\d+)\/(\d+)$/))) return +m[1] + (m[1].startsWith("-") ? -1 : 1) * (+m[2] / +m[3]);
    if ((m = s.match(/^(-?\d+)\/(\d+)$/))) return +m[2] === 0 ? NaN : +m[1] / +m[2];
    if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return parseFloat(s);
    return NaN;
  }
  const num = (x, d = 2) => (isFinite(x) ? Number(x).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 }) : "–");
  const fixed = (x, d = 2) => (isFinite(x) ? Number(x).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }) : "–");
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);

  // Inches to the nearest 1/16, e.g. 7.31 -> 7 5/16″
  function inchFrac(inches) {
    const sixteenths = Math.round(inches * 16);
    const whole = Math.trunc(sixteenths / 16);
    const rem = Math.abs(sixteenths % 16);
    if (!rem) return `${whole}″`;
    const g = gcd(rem, 16);
    return `${whole ? whole + " " : ""}${rem / g}/${16 / g}″`;
  }
  // Inches to feet-inches, e.g. 150.5 -> 12′ 6 1/2″
  function ftIn(inches) {
    const sixteenths = Math.round(inches * 16);
    const ft = Math.floor(sixteenths / 192);
    const restIn = (sixteenths - ft * 192) / 16;
    if (!ft) return inchFrac(restIn);
    return `${ft}′ ${inchFrac(restIn)}`;
  }

  // ---------- icons ----------
  const ICONS = {
    concrete: '<path d="M3 18h18M5 18l2-8h10l2 8M9 10V6h6v4"/>',
    brick: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 12h18M9 5v7M15 12v7"/>',
    board: '<path d="M3 8l4-4h14v12l-4 4H3z"/><path d="M3 8h14v12M17 8l4-4"/>',
    stairs: '<path d="M3 20h5v-5h5v-5h5V5h3"/>',
    pipe: '<path d="M3 7h10a4 4 0 0 1 4 4v10"/><path d="M3 12h7a2 2 0 0 1 2 2v7"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    tile: '<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/>',
    square: '<path d="M4 20V4l16 16H4z"/><path d="M4 15h5v5"/>',
    convert: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  };
  const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

  // ---------- unit converter tables ----------
  const CONV = {
    length: { name: "Length", units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: IN, ft: FT, yd: 0.9144, mi: 1609.344 } },
    area: { name: "Area", units: { "cm²": 1e-4, "m²": 1, ha: 1e4, "in²": IN * IN, "ft²": FT * FT, "yd²": 0.836127, acre: 4046.86 } },
    volume: { name: "Volume", units: { mL: 1e-6, L: 0.001, "m³": 1, "in³": 1.6387e-5, "ft³": FT3, "yd³": YD3, "US gal": GAL, "UK gal": 0.00454609 } },
    weight: { name: "Weight", units: { g: 0.001, kg: 1, tonne: 1000, oz: 0.0283495, lb: LB, "US ton": 907.185 } },
    pressure: { name: "Pressure", units: { kPa: 1000, bar: 1e5, psi: 6894.76, "ft of water": 2989.07, "m of water": 9806.65 } },
    temperature: { name: "Temperature", units: { "°C": 1, "°F": 1, K: 1 } },
  };
  function toKelvin(v, u) { return u === "°C" ? v + 273.15 : u === "°F" ? (v - 32) * 5 / 9 + 273.15 : v; }
  function fromKelvin(k, u) { return u === "°C" ? k - 273.15 : u === "°F" ? (k - 273.15) * 9 / 5 + 32 : k; }
  function convert(v, cat, from, to) {
    if (cat === "temperature") return fromKelvin(toKelvin(v, from), to);
    const u = CONV[cat].units;
    return v * u[from] / u[to];
  }

  // ---------- calculators ----------
  // Field: { id, label, unit: {imperial, metric}, def: {imperial, metric}, type, options, show, help, optional, allowZero }
  const sys = (s, imperial, metric) => (s === "imperial" ? imperial : metric);

  const TOOLS = [
    {
      id: "concrete", trade: "Masonry", name: "Concrete", icon: "concrete",
      desc: "Volume to order and premix bags for a slab, footing or round column.",
      fields: [
        { id: "shape", label: "Shape", type: "select", wide: true, def: { imperial: "slab", metric: "slab" },
          options: () => [["slab", "Slab or footing"], ["column", "Round column or post hole"]] },
        { id: "length", label: "Length", unit: { imperial: "ft", metric: "m" }, def: { imperial: "12", metric: "4" }, show: (v) => v.shape === "slab" },
        { id: "width", label: "Width", unit: { imperial: "ft", metric: "m" }, def: { imperial: "10", metric: "3" }, show: (v) => v.shape === "slab" },
        { id: "depth", label: "Thickness", unit: { imperial: "in", metric: "mm" }, def: { imperial: "4", metric: "100" }, show: (v) => v.shape === "slab" },
        { id: "diameter", label: "Diameter", unit: { imperial: "in", metric: "mm" }, def: { imperial: "12", metric: "300" }, show: (v) => v.shape === "column" },
        { id: "height", label: "Depth or height", unit: { imperial: "ft", metric: "m" }, def: { imperial: "3", metric: "0.9" }, show: (v) => v.shape === "column" },
        { id: "qty", label: "How many", unit: { imperial: "pcs", metric: "pcs" }, def: { imperial: "1", metric: "1" } },
        { id: "waste", label: "Extra for waste", unit: { imperial: "%", metric: "%" }, def: { imperial: "10", metric: "10" }, allowZero: true },
        { id: "bag", label: "Premix bag size", type: "select", def: { imperial: "80", metric: "25" },
          options: (s) => sys(s, [["40", "40 lb"], ["60", "60 lb"], ["80", "80 lb"]], [["20", "20 kg"], ["25", "25 kg"], ["40", "40 kg"]]) },
      ],
      compute(v, s) {
        const imp = s === "imperial";
        const steps = [];
        let m3;
        if (v.shape === "slab") {
          m3 = imp ? v.length * FT * v.width * FT * v.depth * IN : v.length * v.width * v.depth / 1000;
          steps.push(imp
            ? `${num(v.length)} ft × ${num(v.width)} ft × ${num(v.depth)} in ÷ 12 = ${num(m3 / FT3)} ft³`
            : `${num(v.length)} m × ${num(v.width)} m × ${num(v.depth)} mm ÷ 1000 = ${num(m3, 3)} m³`);
        } else {
          const r = imp ? v.diameter * IN / 2 : v.diameter / 2000;
          m3 = Math.PI * r * r * (imp ? v.height * FT : v.height);
          steps.push(imp
            ? `π × (${num(v.diameter)} in ÷ 2 ÷ 12)² × ${num(v.height)} ft = ${num(m3 / FT3)} ft³`
            : `π × (${num(v.diameter)} mm ÷ 2 ÷ 1000)² × ${num(v.height)} m = ${num(m3, 3)} m³`);
        }
        if (v.qty !== 1) { m3 *= v.qty; steps.push(`× ${num(v.qty)} pieces = ${imp ? num(m3 / FT3) + " ft³" : num(m3, 3) + " m³"}`); }
        const total = m3 * (1 + v.waste / 100);
        steps.push(`+ ${num(v.waste)}% waste = ${imp ? num(total / FT3) + " ft³" : num(total, 3) + " m³"}`);
        const bag = +v.bag;
        const yieldM3 = imp ? bag * 0.0075 * FT3 : bag * 0.000468;   // 80 lb ≈ 0.6 ft³, 25 kg ≈ 0.0117 m³
        const bags = Math.ceil(total / yieldM3 - 1e-9);
        if (imp) steps.push(`${num(total / FT3)} ft³ ÷ 27 = ${num(total / YD3)} yd³`);
        steps.push(imp
          ? `${num(total / FT3)} ft³ ÷ ${num(bag * 0.0075)} ft³ per ${bag} lb bag = ${num(total / yieldM3, 1)}, round up to ${bags}`
          : `${num(total, 3)} m³ ÷ ${num(yieldM3, 4)} m³ per ${bag} kg bag = ${num(total / yieldM3, 1)}, round up to ${bags}`);
        const order = imp ? Math.ceil(total / YD3 * 4 - 1e-9) / 4 : Math.ceil(total * 10 - 1e-9) / 10;
        return {
          label: "Concrete needed",
          value: imp ? fixed(total / YD3) : fixed(total),
          unit: imp ? "yd³" : "m³",
          alt: imp ? `${num(total / FT3, 1)} ft³ · ${num(total, 2)} m³` : `${num(total * 1000, 0)} litres · ${num(total / YD3)} yd³`,
          facts: [
            [`${bag} ${imp ? "lb" : "kg"} premix bags`, `${bags} bags`],
            ["Ready-mix order", imp ? `${num(order)} yd³` : `${num(order, 1)} m³`],
            ["Before waste", imp ? `${num(m3 / YD3)} yd³` : `${num(m3, 3)} m³`],
          ],
          steps,
          note: imp ? "Ready-mix shown rounded up to the next ¼ yd³. Bag yields are typical; check the bag." : "Ready-mix shown rounded up to the next 0.1 m³. Bag yields are typical; check the bag.",
        };
      },
    },
    {
      id: "bricks", trade: "Masonry", name: "Bricks and blocks", icon: "brick",
      desc: "How many bricks or blocks for a single-skin wall, after doors and windows.",
      fields: [
        { id: "unitType", label: "Unit", type: "select", wide: true, def: { imperial: "brick", metric: "brick" },
          options: (s) => sys(s,
            [["brick", "Modular brick, 7 5/8 × 2 1/4 in face"], ["block", "Concrete block, 15 5/8 × 7 5/8 in face"]],
            [["brick", "Standard brick, 215 × 65 mm face"], ["block", "Concrete block, 440 × 215 mm face"]]) },
        { id: "length", label: "Wall length", unit: { imperial: "ft", metric: "m" }, def: { imperial: "20", metric: "6" } },
        { id: "height", label: "Wall height", unit: { imperial: "ft", metric: "m" }, def: { imperial: "8", metric: "2.4" } },
        { id: "openings", label: "Doors and windows", unit: { imperial: "ft²", metric: "m²" }, def: { imperial: "21", metric: "2" }, allowZero: true, help: "Total area to leave out" },
        { id: "joint", label: "Mortar joint", unit: { imperial: "in", metric: "mm" }, def: { imperial: "3/8", metric: "10" }, allowZero: true },
        { id: "waste", label: "Extra for waste", unit: { imperial: "%", metric: "%" }, def: { imperial: "5", metric: "5" }, allowZero: true },
      ],
      compute(v, s) {
        const imp = s === "imperial";
        const dims = imp ? { brick: [7.625, 2.25], block: [15.625, 7.625] } : { brick: [215, 65], block: [440, 215] };
        const [l, h] = dims[v.unitType];
        const gross = v.length * v.height;
        const net = gross - v.openings;
        if (net <= 0) return { error: "Doors and windows take up the whole wall. Check the openings area." };
        const per = (imp ? 144 : 1e6) / ((l + v.joint) * (h + v.joint));
        const raw = net * per;
        const total = Math.ceil(raw * (1 + v.waste / 100) - 1e-9);
        const au = imp ? "ft²" : "m²";
        const lu = imp ? "in" : "mm";
        return {
          label: v.unitType === "brick" ? "Bricks needed" : "Blocks needed",
          value: num(total, 0), unit: v.unitType === "brick" ? "bricks" : "blocks",
          alt: `${num(per, 2)} per ${au} with a ${imp ? inchFrac(v.joint) : num(v.joint) + " mm"} joint`,
          facts: [
            ["Wall area", `${num(gross)} ${au}`],
            ["Area to build", `${num(net)} ${au}`],
            ["Before waste", `${num(Math.ceil(raw), 0)}`],
          ],
          steps: [
            `${num(v.length)} × ${num(v.height)} = ${num(gross)} ${au} wall`,
            `${num(gross)} − ${num(v.openings)} openings = ${num(net)} ${au}`,
            `${imp ? "144 in²" : "1,000,000 mm²"} ÷ ((${num(l, 3)} + ${num(v.joint, 3)}) × (${num(h, 3)} + ${num(v.joint, 3)}) ${lu}²) = ${num(per, 2)} per ${au}`,
            `${num(net)} × ${num(per, 2)} = ${num(raw, 0)}`,
            `+ ${num(v.waste)}% waste = ${num(total, 0)}`,
          ],
          note: "For a double-skin wall, double the count.",
        };
      },
    },
    {
      id: "boardfeet", trade: "Woodwork", name: "Board feet", icon: "board",
      desc: "Lumber volume and cost for a stack of boards of the same size.",
      fields: [
        { id: "thick", label: "Thickness", unit: { imperial: "in", metric: "mm" }, def: { imperial: "2", metric: "50" } },
        { id: "width", label: "Width", unit: { imperial: "in", metric: "mm" }, def: { imperial: "6", metric: "150" } },
        { id: "length", label: "Length", unit: { imperial: "ft", metric: "m" }, def: { imperial: "8", metric: "2.4" } },
        { id: "qty", label: "How many boards", unit: { imperial: "pcs", metric: "pcs" }, def: { imperial: "10", metric: "10" } },
        { id: "price", label: "Price", unit: { imperial: "$ / bd ft", metric: "per m³" }, def: { imperial: "4.50", metric: "" }, optional: true, allowZero: true, help: "Optional" },
      ],
      compute(v, s) {
        const imp = s === "imperial";
        const m3 = imp ? v.thick * IN * v.width * IN * v.length * FT * v.qty : v.thick / 1000 * v.width / 1000 * v.length * v.qty;
        const bf = imp ? v.thick * v.width * v.length / 12 * v.qty : m3 / 0.00235974;
        const cost = v.price == null ? null : (imp ? bf * v.price : m3 * v.price);
        const facts = imp
          ? [["Per board", `${num(v.thick * v.width * v.length / 12)} bd ft`], ["Volume", `${num(m3, 3)} m³ · ${num(m3 / FT3)} ft³`]]
          : [["Board feet", `${num(bf, 1)} bd ft`], ["Running length", `${num(v.length * v.qty)} m`]];
        if (cost != null) facts.push(["Cost", imp ? `$${fixed(cost)}` : fixed(cost)]);
        return {
          label: imp ? "Board feet" : "Timber volume",
          value: imp ? num(bf, 2) : fixed(m3, 3), unit: imp ? "bd ft" : "m³",
          alt: imp ? `${num(v.length * v.qty)} ft running length` : `${num(m3 * 1000, 1)} litres`,
          facts,
          steps: imp
            ? [`${num(v.thick)} in × ${num(v.width)} in × ${num(v.length)} ft ÷ 12 = ${num(v.thick * v.width * v.length / 12)} bd ft per board`,
               `× ${num(v.qty)} boards = ${num(bf)} bd ft`].concat(cost != null ? [`× $${fixed(v.price)} = $${fixed(cost)}`] : [])
            : [`${num(v.thick)} mm × ${num(v.width)} mm × ${num(v.length)} m ÷ 1,000,000 = ${num(m3 / v.qty, 4)} m³ per board`,
               `× ${num(v.qty)} boards = ${num(m3, 3)} m³`].concat(cost != null ? [`× ${fixed(v.price)} = ${fixed(cost)}`] : []),
          note: imp ? "Use nominal sizes for rough lumber and actual sizes for dressed stock, matching how your yard prices it." : "One board foot is 0.00236 m³.",
        };
      },
    },
    {
      id: "stairs", trade: "Woodwork", name: "Stairs", icon: "stairs",
      desc: "Number of steps, riser height, run and stringer length from the floor-to-floor height.",
      fields: [
        { id: "rise", label: "Total rise (floor to floor)", wide: true, unit: { imperial: "in", metric: "mm" }, def: { imperial: "108", metric: "2700" } },
        { id: "maxRiser", label: "Highest riser allowed", unit: { imperial: "in", metric: "mm" }, def: { imperial: "7 3/4", metric: "190" } },
        { id: "tread", label: "Tread depth (going)", unit: { imperial: "in", metric: "mm" }, def: { imperial: "10", metric: "250" } },
      ],
      compute(v, s) {
        const imp = s === "imperial";
        const risers = Math.ceil(v.rise / v.maxRiser - 1e-9);
        const riser = v.rise / risers;
        const treads = risers - 1;
        const run = treads * v.tread;
        const stringer = Math.hypot(v.rise, run);
        const angle = Math.atan(riser / v.tread) * 180 / Math.PI;
        const pace = 2 * riser + v.tread;
        const L = (x) => (imp ? ftIn(x) : `${num(x, 0)} mm`);
        const S = (x) => (imp ? inchFrac(x) : `${num(x, 1)} mm`);
        const paceOk = imp ? pace >= 24 && pace <= 25.5 : pace >= 600 && pace <= 650;
        const angleOk = angle >= 30 && angle <= 38;
        return {
          label: "Risers",
          value: num(risers, 0), unit: `steps of ${S(riser)}`,
          alt: `${treads} treads · ${num(angle, 1)}° pitch`,
          facts: [
            ["Riser height", S(riser)],
            ["Total run", L(run)],
            ["Stringer length", L(stringer)],
            ["Treads", `${treads}`],
          ],
          checks: [
            [paceOk, `Step comfort (2 risers + 1 tread): ${S(pace)}. ${imp ? "Aim for 24″ to 25 1/2″." : "Aim for 600 to 650 mm."}`],
            [angleOk, `Pitch ${num(angle, 1)}°. Most stairs feel right between 30° and 38°.`],
          ],
          steps: [
            `${S(v.rise)} ÷ ${S(v.maxRiser)} max = ${num(v.rise / v.maxRiser, 2)}, round up to ${risers} risers`,
            `${S(v.rise)} ÷ ${risers} = ${S(riser)} per riser`,
            `${risers} − 1 = ${treads} treads × ${S(v.tread)} = ${L(run)} run`,
            `√(rise² + run²) = ${L(stringer)} stringer (before cutting the ends)`,
          ],
          note: "Check your local building code for riser, tread and headroom limits.",
        };
      },
    },
    {
      id: "pipefall", trade: "Plumbing", name: "Drain pipe fall", icon: "pipe",
      desc: "How much a drain drops over its run at a given slope.",
      fields: [
        { id: "length", label: "Pipe run", unit: { imperial: "ft", metric: "m" }, def: { imperial: "40", metric: "12" } },
        { id: "slope", label: "Slope", type: "select", def: { imperial: "0.25", metric: "2" },
          options: (s) => sys(s,
            [["0.125", "1/8 in per ft"], ["0.25", "1/4 in per ft"], ["0.5", "1/2 in per ft"]],
            [["1", "1% (1 in 100)"], ["1.25", "1.25% (1 in 80)"], ["2", "2% (1 in 50)"], ["2.5", "2.5% (1 in 40)"]]) },
      ],
      compute(v, s) {
        const imp = s === "imperial";
        const slope = +v.slope;
        const pct = imp ? slope / 12 * 100 : slope;
        const fall = imp ? v.length * slope : v.length * slope * 10;   // inches | mm
        const angle = Math.atan(pct / 100) * 180 / Math.PI;
        return {
          label: "Total fall",
          value: imp ? ftIn(fall) : num(fall, 0), unit: imp ? "" : "mm",
          alt: imp ? `${num(fall, 2)} in · ${num(fall * 25.4, 0)} mm` : `${num(fall / 25.4, 2)} in`,
          facts: [
            ["Slope", `${num(pct, 2)}%`],
            ["Ratio", `1 in ${num(100 / pct, 0)}`],
            ["Angle", `${num(angle, 2)}°`],
            [imp ? "Per 10 ft" : "Per metre", imp ? inchFrac(slope * 10) : `${num(slope * 10, 1)} mm`],
          ],
          steps: imp
            ? [`${num(v.length)} ft × ${inchFrac(slope)} per ft = ${num(fall, 3)} in`, `${num(fall, 3)} in ≈ ${ftIn(fall)} (to the nearest 1/16″)`]
            : [`${num(v.length)} m × ${num(slope)}% = ${num(v.length)} × ${num(slope / 100, 4)} m`, `= ${num(fall / 1000, 3)} m = ${num(fall, 0)} mm`],
          note: "Minimum slopes depend on pipe size and local plumbing code.",
        };
      },
    },
    {
      id: "pipevol", trade: "Plumbing", name: "Water in a pipe", icon: "drop",
      desc: "How much water a run of pipe holds, for filling, draining or flushing.",
      fields: [
        { id: "diameter", label: "Inside diameter", unit: { imperial: "in", metric: "mm" }, def: { imperial: "2", metric: "50" }, help: "The bore, not the nominal size" },
        { id: "length", label: "Length", unit: { imperial: "ft", metric: "m" }, def: { imperial: "100", metric: "30" } },
      ],
      compute(v, s) {
        const imp = s === "imperial";
        const r = imp ? v.diameter * IN / 2 : v.diameter / 2000;
        const m3 = Math.PI * r * r * (imp ? v.length * FT : v.length);
        const litres = m3 * 1000;
        return {
          label: "Water held",
          value: imp ? num(m3 / GAL, 2) : num(litres, 1), unit: imp ? "US gal" : "litres",
          alt: imp ? `${num(litres, 1)} litres` : `${num(m3 / GAL, 2)} US gal`,
          facts: [
            ["Weight of water", imp ? `${num(litres / LB, 1)} lb` : `${num(litres, 1)} kg`],
            [imp ? "Per foot" : "Per metre", imp ? `${num(m3 / GAL / v.length, 3)} gal` : `${num(litres / v.length, 2)} L`],
          ],
          steps: imp
            ? [`π × (${num(v.diameter)} in ÷ 2)² = ${num(Math.PI * (v.diameter / 2) ** 2, 3)} in² bore`,
               `× ${num(v.length)} ft × 12 = ${num(Math.PI * (v.diameter / 2) ** 2 * v.length * 12, 0)} in³`,
               `÷ 231 in³ per gallon = ${num(m3 / GAL, 2)} US gal`]
            : [`π × (${num(v.diameter)} mm ÷ 2)² = ${num(Math.PI * (v.diameter / 2) ** 2, 0)} mm² bore`,
               `× ${num(v.length)} m = ${num(m3, 4)} m³`,
               `× 1000 = ${num(litres, 1)} litres`],
          note: "Water weighs about 1 kg per litre (8.34 lb per US gallon).",
        };
      },
    },
    {
      id: "tiles", trade: "Tiling and flooring", name: "Tiles and flooring", icon: "tile",
      desc: "Tiles and boxes for a rectangular floor or wall, with grout joints and waste.",
      fields: [
        { id: "length", label: "Area length", unit: { imperial: "ft", metric: "m" }, def: { imperial: "12", metric: "4" } },
        { id: "width", label: "Area width", unit: { imperial: "ft", metric: "m" }, def: { imperial: "10", metric: "3" } },
        { id: "tileL", label: "Tile length", unit: { imperial: "in", metric: "mm" }, def: { imperial: "24", metric: "600" } },
        { id: "tileW", label: "Tile width", unit: { imperial: "in", metric: "mm" }, def: { imperial: "12", metric: "300" } },
        { id: "joint", label: "Grout joint", unit: { imperial: "in", metric: "mm" }, def: { imperial: "1/8", metric: "3" }, allowZero: true },
        { id: "waste", label: "Extra for cuts", unit: { imperial: "%", metric: "%" }, def: { imperial: "10", metric: "10" }, allowZero: true, help: "10% straight, 15% diagonal" },
        { id: "perBox", label: "Tiles per box", unit: { imperial: "pcs", metric: "pcs" }, def: { imperial: "8", metric: "8" }, optional: true, help: "Optional" },
      ],
      compute(v, s) {
        const imp = s === "imperial";
        const area = v.length * v.width;
        const tileArea = imp ? (v.tileL + v.joint) * (v.tileW + v.joint) / 144 : (v.tileL + v.joint) * (v.tileW + v.joint) / 1e6;
        const raw = area / tileArea;
        const tiles = Math.ceil(raw * (1 + v.waste / 100) - 1e-9);
        const au = imp ? "ft²" : "m²";
        const facts = [["Area", `${num(area)} ${au}`], ["Before waste", `${num(Math.ceil(raw - 1e-9), 0)} tiles`]];
        const steps = [
          `${num(v.length)} × ${num(v.width)} = ${num(area)} ${au}`,
          `(${num(v.tileL, 3)} + ${num(v.joint, 3)}) × (${num(v.tileW, 3)} + ${num(v.joint, 3)}) ${imp ? "in² ÷ 144" : "mm² ÷ 1,000,000"} = ${num(tileArea, 4)} ${au} per tile`,
          `${num(area)} ÷ ${num(tileArea, 4)} = ${num(raw, 1)} tiles`,
          `+ ${num(v.waste)}% = ${tiles} tiles`,
        ];
        if (v.perBox) {
          const boxes = Math.ceil(tiles / v.perBox - 1e-9);
          facts.unshift(["Boxes", `${boxes} boxes`]);
          steps.push(`${tiles} ÷ ${num(v.perBox)} per box = ${boxes} boxes`);
        }
        return {
          label: "Tiles needed", value: num(tiles, 0), unit: "tiles",
          alt: `${num(area * (1 + v.waste / 100))} ${au} to buy`,
          facts, steps,
          note: "Buy from one batch (lot number) so the color matches.",
        };
      },
    },
    {
      id: "square", trade: "General", name: "Square and diagonal", icon: "square",
      desc: "The diagonal that proves a corner is square, for setting out walls, decks and slabs.",
      fields: [
        { id: "a", label: "Side A", unit: { imperial: "ft", metric: "m" }, def: { imperial: "12", metric: "4" } },
        { id: "b", label: "Side B", unit: { imperial: "ft", metric: "m" }, def: { imperial: "16", metric: "3" } },
      ],
      compute(v, s) {
        const imp = s === "imperial";
        const c = Math.hypot(v.a, v.b);
        const angle = Math.atan(v.a / v.b) * 180 / Math.PI;
        return {
          label: "Diagonal",
          value: imp ? ftIn(c * 12) : num(c, 3), unit: imp ? "" : "m",
          alt: imp ? `${num(c, 3)} ft · ${num(c * FT, 3)} m` : `${num(c * 1000, 0)} mm`,
          facts: [
            ["Angle at side B", `${num(angle, 1)}°`],
            ["Angle at side A", `${num(90 - angle, 1)}°`],
          ],
          checks: [[true, imp
            ? "Quick check: mark 3 ft and 4 ft from the corner. They're 5 ft apart when it's square (6-8-10 on bigger work)."
            : "Quick check: mark 0.6 m and 0.8 m from the corner. They're 1.0 m apart when it's square (3-4-5 m on bigger work)."]],
          steps: imp
            ? [`${num(v.a)}² + ${num(v.b)}² = ${num(v.a * v.a + v.b * v.b)}`, `√${num(v.a * v.a + v.b * v.b)} = ${num(c, 4)} ft`, `= ${ftIn(c * 12)} (to the nearest 1/16″)`]
            : [`${num(v.a)}² + ${num(v.b)}² = ${num(v.a * v.a + v.b * v.b, 4)}`, `√${num(v.a * v.a + v.b * v.b, 4)} = ${num(c, 4)} m`],
          note: "For a rectangle, both diagonals should match.",
        };
      },
    },
    {
      id: "convert", trade: "General", name: "Unit converter", icon: "convert",
      desc: "Length, area, volume, weight, pressure and temperature, including feet and inches.",
      fields: [
        { id: "cat", label: "Measure", type: "select", wide: true, def: { imperial: "length", metric: "length" },
          options: () => Object.entries(CONV).map(([k, c]) => [k, c.name]) },
        { id: "value", label: "Value", wide: true, def: { imperial: "12.5", metric: "3.2" }, allowZero: true, allowNegative: true },
        { id: "from", label: "From", type: "select", def: { imperial: "ft", metric: "m" }, dependsOn: "cat",
          options: (s, v) => Object.keys(CONV[v.cat].units).map((u) => [u, u]) },
        { id: "to", label: "To", type: "select", def: { imperial: "m", metric: "ft" }, dependsOn: "cat",
          options: (s, v) => Object.keys(CONV[v.cat].units).map((u) => [u, u]), pickSecond: true },
      ],
      compute(v) {
        const out = convert(v.value, v.cat, v.from, v.to);
        const facts = Object.keys(CONV[v.cat].units).filter((u) => u !== v.from && u !== v.to)
          .map((u) => [u, num(convert(v.value, v.cat, v.from, u), 4)]);
        const steps = [];
        if (v.cat === "temperature") {
          steps.push(`${num(v.value, 4)} ${v.from} → ${num(out, 4)} ${v.to}`);
          if (v.from === "°F" && v.to === "°C") steps.unshift("(°F − 32) × 5/9 = °C");
          if (v.from === "°C" && v.to === "°F") steps.unshift("°C × 9/5 + 32 = °F");
        } else {
          steps.push(`1 ${v.from} = ${num(convert(1, v.cat, v.from, v.to), 6)} ${v.to}`);
          steps.push(`${num(v.value, 4)} × ${num(convert(1, v.cat, v.from, v.to), 6)} = ${num(out, 4)} ${v.to}`);
        }
        let alt = "";
        if (v.cat === "length") alt = `= ${ftIn(convert(v.value, "length", v.from, "in"))} in feet and inches`;
        return {
          label: `${CONV[v.cat].name} in ${v.to}`,
          value: num(out, 4), unit: v.to, alt, facts, steps,
          factsTitle: "Same value in other units",
        };
      },
    },
  ];

  // ---------- state & storage ----------
  // Saved through shared/storage.js as easyAbacus:job-site:settings, :inputs and :last
  const { storage } = window.EasyAbacus;
  const store = storage.createStore("job-site");
  storage.migrate("jobSiteCalc.v1", (old) => {   // data saved by the first version
    store.set("settings", { system: old.system, tool: old.tool });
    if (old.values) store.set("inputs", old.values);
  });

  const defaultSystem = () => (navigator.language === "en-US" ? "imperial" : "metric");
  function loadSettings() {
    const s = store.get("settings", {});
    return {
      system: s.system === "metric" || s.system === "imperial" ? s.system : defaultSystem(),
      tool: TOOLS.some((t) => t.id === s.tool) ? s.tool : "concrete",
    };
  }
  function loadInputs() { const v = store.get("inputs", {}); return v && typeof v === "object" ? v : {}; }
  const state = { ...loadSettings(), values: loadInputs() };
  const persist = () => {
    store.set("settings", { system: state.system, tool: state.tool });
    store.set("inputs", state.values);
  };

  const TOOL_BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
  const tool = () => TOOL_BY_ID[state.tool];
  function vals(t = tool()) {
    state.values[t.id] ??= {};
    const bucket = (state.values[t.id][state.system] ??= {});
    for (const f of t.fields) if (!(f.id in bucket)) bucket[f.id] = f.def[state.system];
    // keep dependent selects valid (e.g. converter units after the measure changes)
    for (const f of t.fields) {
      if (f.type !== "select") continue;
      const opts = f.options(state.system, bucket).map((o) => o[0]);
      if (!opts.includes(bucket[f.id])) bucket[f.id] = opts[f.pickSecond && opts.length > 1 ? 1 : 0];
    }
    return bucket;
  }

  // ---------- rendering ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function renderNav() {
    const groups = [];
    for (const t of TOOLS) {
      let g = groups.find((x) => x.trade === t.trade);
      if (!g) groups.push(g = { trade: t.trade, tools: [] });
      g.tools.push(t);
    }
    $("toolNav").innerHTML = groups.map((g) => `
      <div><h2>${g.trade}</h2><ul>${g.tools.map((t) => `
        <li><button type="button" class="tool-btn" data-tool="${t.id}" ${t.id === state.tool ? 'aria-current="page"' : ""}>${icon(t.icon)}${t.name}</button></li>`).join("")}
      </ul></div>`).join("");
  }

  function renderForm(focusId) {
    const t = tool();
    const v = vals(t);
    $("toolTrade").textContent = t.trade;
    $("toolName").textContent = t.name;
    $("toolDesc").textContent = t.desc;
    $("fields").innerHTML = t.fields.filter((f) => !f.show || f.show(v)).map((f) => {
      const id = `f-${f.id}`;
      const unit = f.unit ? f.unit[state.system] : "";
      const describedBy = [f.help ? `${id}-help` : "", `${id}-err`].filter(Boolean).join(" ");
      const control = f.type === "select"
        ? `<select id="${id}" data-f="${f.id}">${f.options(state.system, v).map(([val, lab]) => `<option value="${esc(val)}" ${val === v[f.id] ? "selected" : ""}>${esc(lab)}</option>`).join("")}</select>`
        : `<input id="${id}" data-f="${f.id}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(v[f.id] ?? "")}" aria-describedby="${describedBy}">
           ${unit ? `<span class="unit" aria-hidden="true">${esc(unit)}</span>` : ""}`;
      return `<div class="field ${f.wide ? "wide" : ""}" data-field="${f.id}">
        <label for="${id}">${esc(f.label)}${unit ? `<span class="sr-only"> in ${esc(unit)}</span>` : ""}</label>
        <div class="control">${control}</div>
        ${f.help ? `<span class="help" id="${id}-help">${esc(f.help)}</span>` : ""}
        <span class="err" id="${id}-err"></span>
      </div>`;
    }).join("");
    if (focusId) $(focusId)?.focus();
  }

  // Validate inputs, returning numbers or null if something needs fixing.
  function readValues() {
    const t = tool();
    const v = vals(t);
    const out = {};
    let ok = true;
    for (const f of t.fields) {
      if (f.show && !f.show(v)) continue;
      if (f.type === "select") { out[f.id] = v[f.id]; continue; }
      const n = parseQty(v[f.id]);
      let msg = "";
      if (n === null) { if (!f.optional) msg = "Enter a value"; }
      else if (isNaN(n)) msg = "Use a number like 2.5 or 1 1/2";
      else if (n < 0 && !f.allowNegative) msg = "Can't be negative";
      else if (n === 0 && !f.allowZero) msg = "Must be more than 0";
      const fieldEl = document.querySelector(`[data-field="${f.id}"]`);
      if (fieldEl) {
        fieldEl.classList.toggle("invalid", !!msg);
        fieldEl.querySelector(".err").textContent = msg;
        fieldEl.querySelector("input")?.setAttribute("aria-invalid", msg ? "true" : "false");
      }
      if (msg) ok = false;
      out[f.id] = n;
    }
    return ok ? out : null;
  }

  let lastSummary = "";

  // ---------- last calculation ----------
  // Saved once the numbers settle, so every keystroke doesn't count as a calculation.
  let last = store.get("last");
  let lastTimer;
  function recordLast(t, r) {
    clearTimeout(lastTimer);
    lastTimer = setTimeout(() => {
      const entry = { tool: t.id, system: state.system, label: r.label, value: r.value, unit: r.unit || "", at: Date.now() };
      if (last && last.tool === entry.tool && last.value === entry.value && last.unit === entry.unit && last.system === entry.system) return;
      last = entry;
      store.set("last", last);
      renderLast();
    }, 1500);
  }
  function ago(ms) {
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    return new Date(ms).toLocaleDateString();
  }
  function renderLast() {
    const bar = $("lastBar");
    if (!last || !TOOL_BY_ID[last.tool]) { bar.hidden = true; return; }
    const t = TOOL_BY_ID[last.tool];
    bar.hidden = false;
    $("lastBtn").innerHTML = `<span class="lb-tool">${esc(t.name)}</span>
      <span class="lb-value">${esc(last.value)}${last.unit ? " " + esc(last.unit) : ""}</span>
      <span class="lb-time">${esc(ago(last.at))}</span>`;
    $("lastBtn").setAttribute("aria-label", `${t.name}: ${last.label} ${last.value} ${last.unit}, ${ago(last.at)}. Open this calculator`);
  }
  store.onChange("last", (v) => { last = v; renderLast(); });
  let announceTimer;
  function renderResult() {
    const t = tool();
    const v = readValues();
    const body = $("resultBody");
    const r = v ? t.compute(v, state.system) : null;
    if (!r || r.error) {
      body.innerHTML = `<div><div class="primary-label" id="resultHeading">Result</div>
        <p class="empty-msg">${r && r.error ? esc(r.error) : "Fill in the highlighted measurements to see the result."}</p></div>`;
      lastSummary = "";
      return;
    }
    const facts = r.facts && r.facts.length
      ? `${r.factsTitle ? `<div class="primary-label">${esc(r.factsTitle)}</div>` : ""}<dl class="facts">${r.facts.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join("")}</dl>` : "";
    const checks = r.checks ? `<ul class="checks">${r.checks.map(([ok, text]) =>
      `<li><span class="pill ${ok ? "ok" : "check"}">${ok ? "Good" : "Check"}</span><span>${esc(text)}</span></li>`).join("")}</ul>` : "";
    body.innerHTML = `
      <div>
        <div class="primary-label" id="resultHeading">${esc(r.label)}</div>
        <div class="primary"><span class="num">${esc(r.value)}</span>${r.unit ? `<span class="u">${esc(r.unit)}</span>` : ""}</div>
        ${r.alt ? `<div class="primary-alt">${esc(r.alt)}</div>` : ""}
      </div>
      ${facts}
      ${checks}
      <div class="steps"><h3>How it's worked out</h3><ol>${r.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>
      <div class="result-foot">
        ${r.note ? `<p class="note">${esc(r.note)}</p>` : "<span></span>"}
        <button type="button" class="copy-btn" id="copyBtn">Copy result</button>
      </div>`;
    recordLast(t, r);
    lastSummary = [`${t.name}: ${r.label} ${r.value}${r.unit ? " " + r.unit : ""}`]
      .concat(r.alt ? [r.alt] : [])
      .concat((r.facts || []).map(([k, val]) => `${k}: ${val}`)).join("\n");
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => { $("srStatus").textContent = `${r.label}: ${r.value} ${r.unit || ""}`; }, 700);
  }

  // Mark the current tool without rebuilding the list, and bring its chip into view on phones.
  function markCurrentTool() {
    let current;
    document.querySelectorAll("#toolNav [data-tool]").forEach((b) => {
      const on = b.dataset.tool === state.tool;
      if (on) { b.setAttribute("aria-current", "page"); current = b; } else b.removeAttribute("aria-current");
    });
    const strip = $("toolScroll");
    if (current && strip.scrollWidth > strip.clientWidth) {
      const left = current.offsetLeft - strip.clientWidth / 2 + current.offsetWidth / 2;
      strip.scrollTo({ left: Math.max(0, left) });
    }
  }

  function renderAll(focusId) {
    document.querySelectorAll('input[name="system"]').forEach((r) => { r.checked = r.value === state.system; });
    markCurrentTool();
    renderForm(focusId);
    renderResult();
  }

  // Typing can fire faster than the screen refreshes; work the result out once per frame.
  let frame = 0;
  function scheduleResult() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; renderResult(); });
  }
  let saveTimer;
  function persistSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 250); }

  // ---------- events ----------
  $("toolNav").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tool]");
    if (!b || b.dataset.tool === state.tool) return;
    state.tool = b.dataset.tool;
    try { history.replaceState(null, "", "#" + state.tool); } catch { /* sandboxed preview */ }
    persist();
    renderAll();
    if (matchMedia("(max-width: 760px), (orientation: landscape) and (max-height: 500px)").matches && $("sheet").getBoundingClientRect().top < 0) {
      $("sheet").scrollIntoView({ block: "start" });
    }
  });

  document.querySelectorAll('input[name="system"]').forEach((r) => r.addEventListener("change", () => {
    state.system = r.value;
    persist();
    renderAll(r.id);
  }));

  $("fields").addEventListener("input", (e) => {
    const f = e.target.dataset.f;
    if (!f || e.target.tagName !== "INPUT") return;
    vals()[f] = e.target.value;
    persistSoon();
    scheduleResult();
  });
  $("fields").addEventListener("change", (e) => {
    const f = e.target.dataset.f;
    if (!f || e.target.tagName !== "SELECT") return;
    vals()[f] = e.target.value;
    persist();
    renderForm(e.target.id);   // a select can show, hide or change other fields
    renderResult();
  });
  $("inputs").addEventListener("submit", (e) => e.preventDefault());

  $("resetTool").addEventListener("click", () => {
    if (state.values[state.tool]) delete state.values[state.tool][state.system];
    persist();
    renderForm();
    renderResult();
    $("srStatus").textContent = "Example values restored";
  });

  $("resultBody").addEventListener("click", async (e) => {
    const b = e.target.closest("#copyBtn");
    if (!b || !lastSummary) return;
    try {
      await navigator.clipboard.writeText(lastSummary);
      b.textContent = "Copied";
    } catch {
      b.textContent = "Copy blocked: select the text instead";
    }
    setTimeout(() => { if (b.isConnected) b.textContent = "Copy result"; }, 1800);
  });

  // ---------- app install and offline ----------
  let installEvent = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e;
    $("installBtn").hidden = false;
  });
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
      navigator.serviceWorker.register("sw.js").catch(() => { /* not available here; the app still works online */ });
    });
  }
  window.addEventListener("pagehide", persist);

  $("lastBtn").addEventListener("click", () => {
    if (!last || !TOOL_BY_ID[last.tool]) return;
    state.tool = last.tool;
    if (last.system) state.system = last.system;
    persist();
    renderAll();
    $("toolName").setAttribute("tabindex", "-1");
    $("toolName").focus();
  });
  setInterval(renderLast, 60000);

  // ---------- theme and settings dialog ----------
  const dialog = $("settingsDialog");
  window.JobSiteTheme.render($("themePanel"));   // mode, accent, colors, contrast (shared/theme.js)
  $("openSettings").addEventListener("click", () => {
    dialog.showModal();
    dialog.querySelector('input[name="t-mode"]:checked')?.focus();
  });
  $("closeSettings").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });   // backdrop
  dialog.addEventListener("close", () => {
    $("resetConfirm").hidden = true;
    $("resetBtn").hidden = false;
    $("openSettings").focus();
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
    window.JobSiteTheme.reset();
    state.system = defaultSystem();
    if ($("resetData").checked) {
      state.values = {};
      last = null;
      store.remove("last");
      renderLast();
    }
    $("resetData").checked = false;
    persist();
    renderAll();
    $("resetConfirm").hidden = true;
    $("resetBtn").hidden = false;
    $("resetBtn").focus();
    $("srStatus").textContent = "Default settings restored";
  });
  // another tab changed the units or measurements
  store.onChange("settings", () => { Object.assign(state, loadSettings()); renderAll(); });

  // Open a tool from a link or home-screen shortcut, e.g. #stairs
  const fromHash = () => { const id = location.hash.slice(1); if (TOOL_BY_ID[id] && id !== state.tool) { state.tool = id; return true; } return false; };
  fromHash();
  window.addEventListener("hashchange", () => { if (fromHash()) { persist(); renderAll(); } });

  renderNav();
  renderAll();
  renderLast();
})();
