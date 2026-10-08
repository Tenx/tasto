#!/usr/bin/env node
// server.mjs — TASTO Vibe MCP (stdio)
// Give it one image → get a tasto-house vi prompt + structured metadata.
//
// Two tools:
//   analyze_image_palette  — pure local algorithm: image → exact PALETTE hex list
//   generate_vi_prompt     — image + brand → writing brief for the host LLM,
//                            with the PALETTE section pre-filled from the algorithm

import { readFile } from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { analyzePalette } from './lib/palette.mjs';
import {
  buildWritingBrief,
  buildPaletteSection,
  CATEGORY_LABELS,
} from './lib/template.mjs';

// Resolve the { pathOrData, kind, cropBottomFraction } source from tool args.
function resolveSource({ image_path, image_base64, crop_vibe_card }) {
  if (image_path && image_base64) {
    throw new Error('Provide either image_path OR image_base64, not both.');
  }
  if (image_path) {
    return { pathOrData: image_path, kind: 'path', cropBottomFraction: crop_vibe_card ? 0.28 : 0 };
  }
  if (image_base64) {
    return { pathOrData: image_base64, kind: 'base64', cropBottomFraction: crop_vibe_card ? 0.28 : 0 };
  }
  throw new Error('Provide image_path or image_base64.');
}

// For generate_vi_prompt we also want the host LLM to SEE the image, so we
// return it as an image content block alongside the text brief.
async function imageContentBlock(source) {
  let buf;
  let mime = 'image/png';
  if (source.kind === 'path') {
    buf = await readFile(source.pathOrData);
    const p = source.pathOrData.toLowerCase();
    if (p.endsWith('.jpg') || p.endsWith('.jpeg')) mime = 'image/jpeg';
    else if (p.endsWith('.webp')) mime = 'image/webp';
    else if (p.endsWith('.gif')) mime = 'image/gif';
  } else {
    const raw = source.pathOrData.startsWith('data:')
      ? source.pathOrData.split(',')[1]
      : source.pathOrData;
    buf = Buffer.from(raw, 'base64');
    const m = source.pathOrData.match(/^data:(image\/[a-z]+);base64/);
    if (m) mime = m[1];
  }
  return { type: 'image', data: buf.toString('base64'), mimeType: mime };
}

const server = new McpServer({
  name: 'tasto-vibe',
  version: '1.0.0',
});

const inputShape = {
  image_path: z.string().optional().describe('Absolute path to a local image file.'),
  image_base64: z
    .string()
    .optional()
    .describe('Base64 image data (raw or a data: URI). Use if the file is not on disk.'),
  crop_vibe_card: z
    .boolean()
    .optional()
    .describe('Set true only for tasto preview.png images that carry a bottom vibe card (~28%). Off by default.'),
  max_colors: z.number().int().min(3).max(8).optional().describe('How many palette colors to extract (3–8, default 6).'),
};

// ── Tool 1: pure-local palette extraction ──────────────────────────────
server.registerTool(
  'analyze_image_palette',
  {
    title: 'Analyze image palette',
    description:
      'Pure local algorithm (no API calls): extract the dominant color palette from an image as exact 6-digit hex, with per-color share, luminance, saturation, and a summary (ground/anchor/tone). Returns tasto-compatible hex.',
    inputSchema: inputShape,
  },
  async (args) => {
    const source = resolveSource(args);
    const report = await analyzePalette(source, { maxColors: args.max_colors ?? 6 });
    return {
      content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
      structuredContent: report,
    };
  }
);

// ── Tool 2: full vi-prompt generation brief ─────────────────────────────
server.registerTool(
  'generate_vi_prompt',
  {
    title: 'Generate TASTO vi prompt',
    description:
      "Given one image and a brand name, extract the palette locally, then return the image plus a writing brief. YOU (the host model) look at the image, classify its tasto category, name the style, and fill the 8-section vi prompt template — the PALETTE section is PRE-FILLED with the locally-extracted hex (copy it verbatim). Output is a portable brand-identity prompt for physical goods AND digital products, plus a JSON metadata block for tasto ingestion.",
    inputSchema: {
      ...inputShape,
      brand: z.string().optional().describe('Brand name to slot into the prompt. Defaults to [BRAND].'),
      style_name_hint: z.string().optional().describe('Optional hint for the style name; the model may refine it.'),
    },
  },
  async (args) => {
    const source = resolveSource(args);
    const report = await analyzePalette(source, { maxColors: args.max_colors ?? 6 });
    const brief = buildWritingBrief({
      brand: args.brand,
      report,
      styleNameHint: args.style_name_hint,
    });
    const img = await imageContentBlock(source);
    return {
      content: [
        img,
        { type: 'text', text: brief },
      ],
      structuredContent: {
        palette: report,
        paletteSection: buildPaletteSection(report),
        categories: CATEGORY_LABELS,
      },
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
