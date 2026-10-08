// lib/template.mjs
// TASTO house vi-prompt template + category taxonomy.
// Kept in sync with index.html (CATEGORY_LABELS, parsePaletteHex format).

// 8 tasto categories — key → English label. Order = sidebar/section order.
export const CATEGORY_LABELS = {
  minimal_modern: 'Minimal & Modern',
  graphic: 'Graphic & Experimental',
  material: 'Material',
  futuristic: 'Futuristic',
  game_worlds: 'Game Worlds',
  cinematic: 'Cinematic & Narrative',
  retro: 'Retro & Era',
  organic: 'Organic & Humanistic',
};

// A one-line hint per category so the host LLM can classify a new image.
export const CATEGORY_HINTS = {
  minimal_modern: 'clean grids, restraint, whitespace, sans-serif, function-first (Swiss, editorial, luxury minimal)',
  graphic: 'bold, loud, experimental, anti-design, maximalist, glitch, kinetic type, Memphis',
  material: 'tactile surfaces & depth — glass, clay, frosted, neumorphism, paper cutout, gradients',
  futuristic: 'sci-fi, cyber, dark tech, HUD, neon, high-tech surfaces',
  game_worlds: 'game-inspired worlds, environment/UI art, stylized 3D scenes',
  cinematic: 'film-grade lighting, narrative mood, letterbox, noir, editorial cinema',
  retro: 'era throwbacks — Bauhaus, synthwave, Y2K, cassette-futurism, vintage print',
  organic: 'natural, humanistic, warm, biophilic, wabi-sabi, ethereal, handmade',
};

/**
 * Turn an analyzePalette() report into a ready-to-paste PALETTE section body
 * that parsePaletteHex() in index.html will parse correctly:
 *  - real 6-digit lowercase hex
 *  - "PALETTE" heading on its own line (added by caller)
 *  - each color as a bullet "- Name — #hex"
 */
export function buildPaletteSection(report) {
  const lines = report.colors.map((c) => `- ${c.name} — ${c.hex}`);
  const intro =
    report.summary.tone === 'muted / near-monochrome'
      ? 'A restrained, near-monochrome palette — mostly structural neutrals with a disciplined accent:'
      : report.summary.tone === 'vivid / high-chroma'
        ? 'A vivid, high-chroma palette — saturated fields used as bold signal:'
        : 'A balanced palette of grounds, an anchor, and accents:';
  const rule =
    'Use these as flat structural fields and signal — the exact hex above is the source of truth for every surface.';
  return `${intro}\n${lines.join('\n')}\n${rule}`;
}

/**
 * The writing brief handed to the HOST LLM. The host looks at the image,
 * classifies it, and fills every [BRACKET]. The PALETTE section is PRE-FILLED
 * with the locally-extracted hex — the host must NOT invent or alter it.
 */
export function buildWritingBrief({ brand, report, styleNameHint }) {
  const paletteBody = buildPaletteSection(report);
  const brandLabel = brand || '[BRAND]';
  const catList = Object.entries(CATEGORY_LABELS)
    .map(([k, v]) => `  - ${k}: ${v} — ${CATEGORY_HINTS[k]}`)
    .join('\n');

  return `You are writing a TASTO "vi" prompt — one portable, tool-agnostic brand-identity prompt a customer pastes into any AI tool (LLM / code-gen / image-gen / design) to generate visuals for BOTH physical goods and digital products.

STEP 1 — Look at the provided image and decide:
  a) A short human style name (e.g. "Swiss International Style", "Neon Cyber HUD", "Warm Wabi-Sabi"). ${styleNameHint ? `The caller suggests: "${styleNameHint}" — refine or replace as the image warrants.` : ''}
  b) Which ONE tasto category it belongs to (return the key):
${catList}

STEP 2 — Write the vi prompt using the EXACT structure below (plain language, NO CSS, NO code blocks, NO mode switches). Fill every [BRACKET].

CRITICAL RULES:
  - The PALETTE section is ALREADY FILLED with hex extracted locally from the image. COPY IT VERBATIM. Do not add, remove, or change any hex. Reuse those exact hex wherever you name a color elsewhere in the prompt.
  - Keep the heading "PALETTE" on its own line exactly as shown.
  - Each of AESTHETIC / TYPOGRAPHY / FORM & LAYOUT / MOTION / MOOD / APPLICATION is prose, not a hex dump.
  - APPLICATION must be one paragraph covering PHYSICAL goods (material + print) AND DIGITAL products (UI/grid/motion), and must end with "the logo/mark stays identical across every medium".
  - End with a DO line, a DON'T line, and the final fill-in line, verbatim.

TEMPLATE TO FILL:
---
Brand: ${brandLabel} — Visual identity in the [Style Name].

AESTHETIC
[one paragraph: the style's soul / origin / worldview]

PALETTE
${paletteBody}

TYPOGRAPHY
[display + body faces, weights, grid/alignment behavior that fit this style]

FORM & LAYOUT
[shapes, edges, texture, composition, logo/mark direction — grounded in what the image shows]

MOTION
[how it animates, or "static / minimal" if not motion-led]

MOOD
[4–5 adjectives + one cultural reference]

APPLICATION
[one paragraph — physical goods AND digital products; end with "the logo/mark stays identical across every medium"]

DO: [one line of positive rules]
DON'T: [one line of prohibitions]

Now apply this identity to: [describe the product — e.g. a t-shirt, a mug, a landing page, an app screen, product packaging].
---

STEP 3 — After the prompt, output a short JSON block for tasto ingestion:
{"category":"<one of the keys above>","styleName":"<the style name>","paletteHex":${JSON.stringify(report.colors.map((c) => c.hex))}}`;
}
