# tasto-vibe MCP

Give it **one image** → get a portable **brand-identity (`vi`) prompt** in the TASTO house format, ready to paste into any AI tool.

- **Palette:** extracted 100% locally (sharp, no API calls) → exact 6-digit hex, tasto-compatible.
- **Style writing:** the vi prompt's descriptive text is written by the **host model** (Claude Desktop / Cursor / Claude Code) that runs this MCP — it sees the image and fills the 8-section template. Zero extra API cost.
- **Overlay, not rewrite:** lives in `tasto/mcp/`, its own `package.json`, does not touch the website or Vercel deploy.

## Tools

| Tool | Input | Returns |
|---|---|---|
| `analyze_image_palette` | `image_path` or `image_base64` (+ `max_colors` 3–8) | JSON palette report: hex list, per-color share/luma/saturation, ground/anchor/tone summary. Pure local. |
| `generate_vi_prompt` | image + `brand` (+ `style_name_hint`) | The image block **+** a writing brief with the PALETTE section pre-filled from the extracted hex. The host model classifies the tasto category, names the style, fills the 8 sections, and emits a JSON metadata block for tasto ingestion. |

Options on both: `crop_vibe_card: true` only for tasto `preview.png` files that carry the bottom vibe card (~28%); off by default for arbitrary user images.

## Install

```bash
cd tasto/mcp
npm install
# if sharp's native binary was blocked by the install-script guard:
npm approve-scripts sharp && npm rebuild sharp
```

Verify:

```bash
npm run check   # syntax
node -e "import('sharp').then(()=>console.log('sharp ok'))"
```

## Configure the host

**Claude Desktop** — `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tasto-vibe": {
      "command": "node",
      "args": ["/Users/I742076/.claude/projects/tasto/mcp/server.mjs"]
    }
  }
}
```

**Claude Code** (project-scoped):

```bash
claude mcp add tasto-vibe -- node /Users/I742076/.claude/projects/tasto/mcp/server.mjs
```

**Cursor** — add the same `command`/`args` under `mcpServers` in its MCP settings.

Restart the host, then ask it: *"Use tasto-vibe to make a vi prompt from this image for brand ACME"* and attach/point to an image.

## How the split works

`generate_vi_prompt` does the deterministic, expensive-to-get-right part locally (exact palette hex that the tasto recolor UI can parse) and delegates the subjective part (what style is this, how does it read) to the multimodal host that's already running. The PALETTE section is handed over pre-filled with the instruction to copy it verbatim, so the recolor swatches in tasto stay in sync automatically.
