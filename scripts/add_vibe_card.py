#!/usr/bin/env python3
"""
TASTO Vibe Card Adder — Version B
===================================
Takes a recreated 4:3 image and adds a frosted glass info card at the bottom.

Usage:
    python3 scripts/add_vibe_card.py --style swiss_style
    python3 scripts/add_vibe_card.py --styles swiss_style cyberpunk bauhaus warm_min surreal_3d
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

CONFIG_PATH = Path.home() / ".ai-hero-photo" / "config.json"
RECREATED_DIR = Path(__file__).parent.parent / "images" / "recreated"
CARD_DIR = Path(__file__).parent.parent / "images" / "recreated_card"

# Style metadata for card content
STYLE_META = {
    "swiss_style": {
        "category": "Minimal & Modern",
        "style":    "Swiss Style",
        "form":     "Grid, Typography, Geometry",
        "color":    "Red, Black, White, Yellow",
        "finish":   "Flat, Crisp, Structured",
    },
    "editorial_min": {
        "category": "Minimal & Modern",
        "style":    "Editorial Minimal",
        "form":     "White Space, Type, Layout",
        "color":    "Ivory, Charcoal, Stone, Ink",
        "finish":   "Clean, Refined, Airy",
    },
    "tech_min": {
        "category": "Minimal & Modern",
        "style":    "Tech Minimal",
        "form":     "Grid, Line, Interface",
        "color":    "White, Silver, Black, Blue",
        "finish":   "Crisp, Precise, Digital",
    },
    "warm_min": {
        "category": "Minimal & Modern",
        "style":    "Warm Minimal",
        "form":     "Organic, Space, Softness",
        "color":    "Sand, Cream, Terracotta, Stone",
        "finish":   "Matte, Tactile, Calm",
    },
    "luxury_min": {
        "category": "Minimal & Modern",
        "style":    "Luxury Minimal",
        "form":     "Proportion, Restraint, Elegance",
        "color":    "Ivory, Gold, Obsidian, Taupe",
        "finish":   "Satin, Polished, Premium",
    },
    "monochrome": {
        "category": "Minimal & Modern",
        "style":    "Monochrome",
        "form":     "Tone, Contrast, Depth",
        "color":    "Black, White, Mid-Gray, Shadow",
        "finish":   "High-Contrast, Stark, Graphic",
    },
    "glassmorphism": {
        "category": "Material & Space",
        "style":    "Glassmorphism",
        "form":     "Transparency, Layer, Blur",
        "color":    "Frost, Ice Blue, Lavender, White",
        "finish":   "Translucent, Soft, Luminous",
    },
    "paper_cutout": {
        "category": "Material & Space",
        "style":    "Paper / Cutout",
        "form":     "Layer, Shadow, Craft",
        "color":    "Cream, Blush, Sage, Peach",
        "finish":   "Tactile, Handmade, Dimensional",
    },
    "cyberpunk": {
        "category": "Futuristic & Sci-Fi",
        "style":    "Cyberpunk",
        "form":     "Neon, Circuit, Urban",
        "color":    "Cyan, Magenta, Black, Purple",
        "finish":   "Glow, Glitch, Chrome",
    },
    "dark_tech": {
        "category": "Futuristic & Sci-Fi",
        "style":    "Dark Technology",
        "form":     "Data, Grid, Interface",
        "color":    "Obsidian, Neon Green, Steel, Void",
        "finish":   "Matte Black, Sharp, Technical",
    },
    "scifi_hud": {
        "category": "Futuristic & Sci-Fi",
        "style":    "Sci-Fi HUD",
        "form":     "HUD, Overlay, Data Viz",
        "color":    "Electric Blue, Orange, Black, Teal",
        "finish":   "Holographic, Precise, Futuristic",
    },
    "cinematic": {
        "category": "Cinematic & Narrative",
        "style":    "Cinematic Dark",
        "form":     "Atmosphere, Light, Scene",
        "color":    "Deep Brown, Gold, Amber, Shadow",
        "finish":   "Film Grain, Moody, Rich",
    },
    "film_noir": {
        "category": "Cinematic & Narrative",
        "style":    "Film Noir",
        "form":     "Silhouette, Shadow, Drama",
        "color":    "Black, Silver, Deep Gray, White",
        "finish":   "High-Contrast, Grainy, Tense",
    },
    "cinematic_editorial": {
        "category": "Cinematic & Narrative",
        "style":    "Cinematic Editorial",
        "form":     "Frame, Narrative, Composition",
        "color":    "Muted Teal, Rust, Cream, Black",
        "finish":   "Cinematic, Graded, Intentional",
    },
    "neo_brutalism": {
        "category": "Graphic & Experimental",
        "style":    "Neo-Brutalism",
        "form":     "Bold, Raw, Offset",
        "color":    "Yellow, Black, White, Red",
        "finish":   "Thick Border, Harsh, Unapologetic",
    },
    "anti_design": {
        "category": "Graphic & Experimental",
        "style":    "Anti-Design",
        "form":     "Collage, Clash, Disruption",
        "color":    "Clash, Neon, Dirt, Acid",
        "finish":   "Torn, Layered, Unfinished",
    },
    "maximalism": {
        "category": "Graphic & Experimental",
        "style":    "Maximalism",
        "form":     "Pattern, Abundance, Density",
        "color":    "Jewel, Gold, Crimson, Emerald",
        "finish":   "Ornate, Rich, Layered",
    },
    "memphis": {
        "category": "Graphic & Experimental",
        "style":    "Memphis",
        "form":     "Shape, Pattern, Play",
        "color":    "Pink, Teal, Yellow, Black",
        "finish":   "Flat, Playful, Graphic",
    },
    "glitch": {
        "category": "Graphic & Experimental",
        "style":    "Glitch Art",
        "form":     "Distortion, Artifact, Error",
        "color":    "Electric Blue, Red, Green, Black",
        "finish":   "Corrupted, Digital, Fragmented",
    },
    "kinetic_typo": {
        "category": "Graphic & Experimental",
        "style":    "Kinetic Typography",
        "form":     "Motion, Letterform, Rhythm",
        "color":    "Black, White, Accent Red, Gray",
        "finish":   "Dynamic, Bold, Expressive",
    },
    "surreal_3d": {
        "category": "Graphic & Experimental",
        "style":    "Surreal 3D",
        "form":     "Fluid, Sculpture, Dreamscape",
        "color":    "Iridescent, Pastel, Deep Shadow",
        "finish":   "Glass, Render, Ethereal",
    },
    "bauhaus": {
        "category": "Retro & Era",
        "style":    "Bauhaus",
        "form":     "Primary Shapes, Balance, Function",
        "color":    "Red, Yellow, Blue, Black",
        "finish":   "Flat, Geometric, Bold",
    },
    "synthwave": {
        "category": "Retro & Era",
        "style":    "Synthwave",
        "form":     "Grid, Horizon, Neon",
        "color":    "Purple, Magenta, Cyan, Black",
        "finish":   "Glow, Retro-Digital, Gradient",
    },
    "y2k": {
        "category": "Retro & Era",
        "style":    "Y2K Revival",
        "form":     "Chrome, Bubble, Futurism",
        "color":    "Silver, Baby Blue, Pink, White",
        "finish":   "Glossy, Metallic, Playful",
    },
    "cassette_fut": {
        "category": "Retro & Era",
        "style":    "Cassette Futurism",
        "form":     "Panel, Analog, Texture",
        "color":    "Beige, Orange, Brown, Cream",
        "finish":   "Worn, Retro-Tech, Tactile",
    },
    "organic_modern": {
        "category": "Organic & Humanistic",
        "style":    "Organic Modern",
        "form":     "Curve, Nature, Form",
        "color":    "Warm White, Sage, Clay, Oak",
        "finish":   "Natural, Breathing, Warm",
    },
    "biophilic": {
        "category": "Organic & Humanistic",
        "style":    "Biophilic",
        "form":     "Leaf, Light, Growth",
        "color":    "Forest Green, Earth, Sky, Moss",
        "finish":   "Organic, Alive, Textured",
    },
    "wabi_sabi": {
        "category": "Organic & Humanistic",
        "style":    "Wabi-Sabi",
        "form":     "Imperfection, Void, Age",
        "color":    "Ash, Rust, Linen, Fog",
        "finish":   "Worn, Quiet, Impermanent",
    },
    "ethereal": {
        "category": "Organic & Humanistic",
        "style":    "Ethereal",
        "form":     "Mist, Light, Float",
        "color":    "Blush, Lavender, Pearl, Cloud",
        "finish":   "Soft, Dreamy, Luminous",
    },
}

CARD_PROMPT = """You will receive a 4:3 original AI-generated image. This image is the ONLY editing target.
Do NOT use any other reference. Do NOT redesign, redraw, or change the main subject.

Your task: add a frosted glass info card at the bottom of the image.

[INPUT DATA]
Primary category: {category}
Secondary style: {style}
FORM: {form}
COLOR: {color}
FINISH: {finish}

[MUST KEEP UNCHANGED]
Preserve the entire input image:
- 4:3 aspect ratio and original resolution
- Main subject, composition, visual center
- All colors, materials, textures, lighting
- Every element position, proportion, and crop

Only edit the bottom glass card zone. Do not modify anything outside the card.

[CARD DIMENSIONS — FIXED]
Based on the full image:
- Card height: fixed at 23% of image height
- Card top: at ~75% from top
- Card bottom: 3% margin from bottom edge
- Card left/right: 3% margin each side
- Card width: ~94% of image width
- Corner radius: 20–24px
- Card spans horizontally across bottom
- NEVER shrink below 22% height
- NEVER auto-fit to content

[GLASS STYLE — ADAPTIVE]
Analyze the image's main colors and bottom area brightness. Pick a low-saturation version of the image's dominant color as the glass tint.
- Transparency: 25–35%
- Original content must show through
- Medium background blur
- 1px low-opacity border
- Subtle short shadow
- NO fixed white or gray glass
- NO fully opaque block
- NO high-saturation glass

[TEXT COLOR — AUTO ADAPT]
- Light glass → dark charcoal or dark brown text
- Dark glass → warm white or cool white text
- Body contrast ≥ 4.5:1
- Style title contrast ≥ 7:1

[FIXED TEXT SIZES — relative to image height]
Style title ({style}):
  - ~5% of image height (≥48px, bold)
  - Use two lines if title is long

Category ({category}):
  - ~2.5% of image height (≥22px, medium, uppercase)

FORM / COLOR / FINISH labels + content:
  - ~2.7% of image height (≥24px)
  - Labels: bold; content: regular

[LAYOUT — two columns]
Left column (~39% of card width):
  {style}
  {category}

Right column (~61% of card width):
  FORM    {form}
  COLOR   {color}
  FINISH  {finish}

All text left-aligned. Both columns vertically centered.
Same label width for FORM / COLOR / FINISH rows.
No icons, buttons, or decorative graphics.
No vertical divider line.

[TYPOGRAPHY]
Neutral modern sans-serif. Clean, professional.
Card font is independent from any font in the image subject.

[ONLY THESE WORDS — exact, no changes]
{style}
{category}
FORM    {form}
COLOR   {color}
FINISH  {finish}

[FINAL CHECK]
- Input image is the AI-generated original (NOT the original reference photo)
- Only the bottom card area is edited
- Card height ~23% of image
- Card width ~94% of image
- Style title ~5% of image height
- Long titles wrap to two lines instead of shrinking
- Glass color matches image palette, stays transparent
- Text has high contrast against final glass brightness
- Readable at 25% thumbnail size
- Image is still native 4:3
- No extra text, logos, or watermarks

Output: one 4:3 high-res image with a consistent-size, adaptive frosted glass card.
"""


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        print("❌ No config found at ~/.ai-hero-photo/config.json")
        sys.exit(1)
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def run_replicate(image_path: Path, prompt: str, token: str) -> bytes:
    import replicate
    os.environ["REPLICATE_API_TOKEN"] = token

    print(f"  → Uploading {image_path.name} to Replicate...")
    with open(image_path, "rb") as f:
        output = replicate.run(
            "openai/gpt-image-2",
            input={
                "prompt": prompt,
                "input_images": [f],
                "quality": "high",
                "output_format": "png",
                "aspect_ratio": "4:3",
            },
        )

    if hasattr(output, "__iter__"):
        result = list(output)
        img_output = result[0] if result else None
    else:
        img_output = output

    if img_output is None:
        raise ValueError("Empty output from Replicate")

    if hasattr(img_output, "read"):
        return img_output.read()
    elif hasattr(img_output, "url"):
        import urllib.request
        with urllib.request.urlopen(img_output.url) as r:
            return r.read()
    else:
        raise ValueError(f"Unknown output type: {type(img_output)}")


def process_style(key: str) -> bool:
    if key not in STYLE_META:
        print(f"❌ Unknown style key: {key}")
        return False

    meta = STYLE_META[key]
    src_path = RECREATED_DIR / f"tasto_{key}.png"

    if not src_path.exists():
        print(f"⚠️  Source not found: {src_path}")
        print(f"   Run recreate_style_images.py --style {key} first")
        return False

    prompt = CARD_PROMPT.format(**meta)
    out_path = CARD_DIR / f"tasto_{key}_card.png"

    print(f"\n{'='*60}")
    print(f"Style:  {meta['style']} ({meta['category']})")
    print(f"Source: {src_path.name}")
    print(f"Output: images/recreated_card/tasto_{key}_card.png")

    cfg = load_config()
    token = cfg.get("replicate_api_token", "")
    if not token:
        print("❌ No Replicate API token")
        return False

    CARD_DIR.mkdir(parents=True, exist_ok=True)

    try:
        img_bytes = run_replicate(src_path, prompt, token)
        out_path.write_bytes(img_bytes)
        size_kb = len(img_bytes) // 1024
        print(f"  ✅ Saved: {out_path.name} ({size_kb}KB)")
        return True
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="TASTO vibe card adder")
    parser.add_argument("--style", help="Single style key")
    parser.add_argument("--styles", nargs="+", help="Multiple style keys")
    parser.add_argument("--delay", type=float, default=3.0)
    args = parser.parse_args()

    keys = []
    if args.style:
        keys = [args.style]
    elif args.styles:
        keys = args.styles
    else:
        keys = list(STYLE_META.keys())

    ok = 0
    for i, key in enumerate(keys):
        success = process_style(key)
        if success:
            ok += 1
        if i < len(keys) - 1:
            time.sleep(args.delay)

    print(f"\nDone: {ok}/{len(keys)} succeeded")


if __name__ == "__main__":
    main()
