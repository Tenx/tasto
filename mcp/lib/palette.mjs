// lib/palette.mjs
// Pure-local palette extraction — no API calls.
// Mirrors the tasto Python sampling approach (quantize + brightness-aware
// dominant colors) but in Node via sharp.

import sharp from 'sharp';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toHex = (r, g, b) =>
  '#' + [r, g, b].map((c) => clamp(c, 0, 255).toString(16).padStart(2, '0')).join('');

// Perceived luminance (ITU-R BT.601), 0..255
const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// Rough saturation 0..1 from RGB
function saturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/**
 * Load an image from a file path or a base64 string (optionally a data: URI)
 * and return a downscaled raw RGB buffer plus dimensions.
 */
async function loadRaw(source, { maxSide = 200 } = {}) {
  let input;
  if (source.pathOrData.startsWith('data:')) {
    const b64 = source.pathOrData.split(',')[1] || '';
    input = Buffer.from(b64, 'base64');
  } else if (source.kind === 'base64') {
    input = Buffer.from(source.pathOrData, 'base64');
  } else {
    input = source.pathOrData; // file path
  }

  let img = sharp(input, { failOn: 'none' }).rotate(); // respect EXIF orientation
  const meta = await img.metadata();

  // Ignore the bottom slice where tasto vibe cards live (~28%), but only when
  // the caller opts in (default off — arbitrary user images have no card).
  if (source.cropBottomFraction && meta.height) {
    const keep = Math.max(1, Math.round(meta.height * (1 - source.cropBottomFraction)));
    img = img.extract({ left: 0, top: 0, width: meta.width, height: keep });
  }

  const resized = img.resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: false });
  const { data, info } = await resized
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height, channels: info.channels };
}

/**
 * Quantize pixels into coarse buckets and count them, tracking an averaged
 * representative color per bucket (so the hex isn't snapped to the grid).
 */
function quantize(data, channels, step = 24) {
  const buckets = new Map();
  const total = data.length / channels;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key =
      (Math.floor(r / step) << 16) | (Math.floor(g / step) << 8) | Math.floor(b / step);
    let e = buckets.get(key);
    if (!e) {
      e = { count: 0, r: 0, g: 0, b: 0 };
      buckets.set(key, e);
    }
    e.count++;
    e.r += r;
    e.g += g;
    e.b += b;
  }
  const out = [];
  for (const e of buckets.values()) {
    out.push({
      r: Math.round(e.r / e.count),
      g: Math.round(e.g / e.count),
      b: Math.round(e.b / e.count),
      count: e.count,
      share: e.count / total,
    });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

// Squared distance in RGB — cheap perceptual-ish dedupe
function dist2(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

/**
 * Pick a diverse, representative palette from quantized buckets.
 * Greedy: always take the most-frequent remaining bucket that is far enough
 * from everything already chosen. Guarantees we don't return 8 near-identical
 * greys when an image is mostly monochrome-with-accents.
 */
function pickPalette(buckets, { maxColors = 8, minSep = 40 } = {}) {
  const chosen = [];
  const minSep2 = minSep * minSep;
  for (const c of buckets) {
    if (chosen.length >= maxColors) break;
    if (chosen.every((p) => dist2(p, c) >= minSep2)) chosen.push(c);
  }
  // If everything was too similar to fill the palette, relax and top up.
  if (chosen.length < 3) {
    for (const c of buckets) {
      if (chosen.length >= 3) break;
      if (!chosen.includes(c)) chosen.push(c);
    }
  }
  return chosen;
}

// Human-ish plain-language color name from RGB (rough hue+value labels,
// tasto PALETTE style — "Deep navy", "Vermilion red", "Cream / paper white").
function nameColor(r, g, b) {
  const l = luma(r, g, b);
  const s = saturation(r, g, b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = l > 200 ? 'Light ' : l < 55 ? 'Deep ' : '';

  if (s < 0.12) {
    if (l > 225) return 'Off-white / paper';
    if (l > 175) return 'Light grey';
    if (l > 95) return 'Mid grey';
    if (l > 40) return 'Charcoal';
    return 'Near-black';
  }

  // Determine dominant hue family
  let hue;
  if (r >= g && r >= b) {
    hue = g >= b ? (g > r * 0.6 ? 'orange' : 'red') : 'magenta';
  } else if (g >= r && g >= b) {
    hue = b > g * 0.6 ? 'teal' : r > g * 0.5 ? 'olive' : 'green';
  } else {
    hue = r > b * 0.6 ? 'violet' : 'blue';
  }
  const hueLabel = {
    red: 'red',
    orange: 'orange / amber',
    olive: 'olive',
    green: 'green',
    teal: 'teal',
    blue: 'blue',
    violet: 'violet',
    magenta: 'magenta / pink',
  }[hue];
  return `${light}${hueLabel}`.trim().replace(/^./, (c) => c.toUpperCase());
}

/**
 * Public API: analyze one image, return a structured palette report.
 * `source` = { pathOrData, kind: 'path'|'base64', cropBottomFraction? }
 */
export async function analyzePalette(source, opts = {}) {
  const maxColors = clamp(opts.maxColors ?? 6, 3, 8);
  const { data, width, height, channels } = await loadRaw(source, opts);
  const buckets = quantize(data, channels, opts.step ?? 24);
  const picked = pickPalette(buckets, { maxColors, minSep: opts.minSep ?? 40 });

  const colors = picked.map((c) => ({
    hex: toHex(c.r, c.g, c.b),
    rgb: [c.r, c.g, c.b],
    name: nameColor(c.r, c.g, c.b),
    share: Math.round(c.share * 1000) / 10, // % with 1 decimal
    luma: Math.round(luma(c.r, c.g, c.b)),
    saturation: Math.round(saturation(c.r, c.g, c.b) * 100) / 100,
  }));

  // Sort output darkest→lightest is unhelpful for a brand palette; keep
  // frequency order but surface the likely ground + anchor for convenience.
  const byLuma = [...colors].sort((a, b) => a.luma - b.luma);
  const ground = colors.reduce((a, b) => (b.share > a.share ? b : a), colors[0]);
  const anchor = byLuma[0]; // darkest → usual "black"
  const brightest = byLuma[byLuma.length - 1];
  const avgSat = colors.reduce((s, c) => s + c.saturation, 0) / colors.length;

  return {
    dimensions: { width, height },
    colors,
    summary: {
      groundHex: ground.hex, // most-frequent = likely background
      anchorHex: anchor.hex, // darkest = likely "black"/text
      brightestHex: brightest.hex,
      averageSaturation: Math.round(avgSat * 100) / 100,
      tone: avgSat < 0.2 ? 'muted / near-monochrome' : avgSat > 0.55 ? 'vivid / high-chroma' : 'balanced',
    },
  };
}
