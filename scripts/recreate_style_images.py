#!/usr/bin/env python3
"""
TASTO Style Image Recreator
============================
Takes existing lark_ reference images and generates original 4:3 AI images
using the style recreation prompt via Replicate gpt-image-2.

Usage:
    python3 scripts/recreate_style_images.py --style swiss_style
    python3 scripts/recreate_style_images.py --all
    python3 scripts/recreate_style_images.py --style cyberpunk --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

CONFIG_PATH = Path.home() / ".ai-hero-photo" / "config.json"
IMAGES_DIR = Path(__file__).parent.parent / "images"
REFS_LARK   = IMAGES_DIR / "refs_lark"
REFS_LEGACY = IMAGES_DIR / "refs_legacy"
OUTPUT_DIR  = IMAGES_DIR / "recreated"

# ── Style manifest: key → (source_path, style category, style name) ──────────
STYLES = {
    # Minimal & Modern
    "swiss_style":    (REFS_LARK   / "lark_swiss.jpg",          "Minimal & Modern",       "Swiss Style"),
    "editorial_min":  (REFS_LARK   / "lark_editorial_min.jpg",  "Minimal & Modern",       "Editorial Minimal"),
    "tech_min":       (REFS_LARK   / "lark_tech_min.webp",       "Minimal & Modern",       "Tech Minimal"),
    "warm_min":       (REFS_LARK   / "lark_warm_min.jpg",        "Minimal & Modern",       "Warm Minimal"),
    "luxury_min":     (REFS_LARK   / "lark_luxury_min.png",      "Minimal & Modern",       "Luxury Minimal"),
    "monochrome":     (REFS_LARK   / "lark_monochrome.png",      "Minimal & Modern",       "Monochrome"),
    # Material & Space
    "glassmorphism":  (REFS_LARK   / "lark_glassmorphism.png",   "Material & Space",       "Glassmorphism"),
    "paper_cutout":   (REFS_LARK   / "lark_paper_cutout.jpg",    "Material & Space",       "Paper / Cutout"),
    # Futuristic & Sci-Fi
    "cyberpunk":      (REFS_LARK   / "lark_cyberpunk.jpg",       "Futuristic & Sci-Fi",    "Cyberpunk"),
    "dark_tech":      (REFS_LARK   / "lark_dark_tech.png",       "Futuristic & Sci-Fi",    "Dark Technology"),
    "scifi_hud":      (REFS_LARK   / "lark_scifi_hud.jpg",       "Futuristic & Sci-Fi",    "Sci-Fi HUD"),
    # Cinematic & Narrative
    "cinematic":      (REFS_LEGACY / "darkacademia.jpg",         "Cinematic & Narrative",  "Cinematic Dark"),
    "film_noir":      (REFS_LEGACY / "rave3.jpg",                "Cinematic & Narrative",  "Film Noir"),
    "cinematic_editorial": (REFS_LEGACY / "darkacademia.jpg",   "Cinematic & Narrative",  "Cinematic Editorial"),
    # Graphic & Experimental
    "neo_brutalism":  (REFS_LARK   / "lark_neo_brutalism.jpg",   "Graphic & Experimental", "Neo-Brutalism"),
    "anti_design":    (REFS_LARK   / "lark_anti_design.jpg",     "Graphic & Experimental", "Anti-Design"),
    "maximalism":     (REFS_LARK   / "lark_maximalism.jpg",      "Graphic & Experimental", "Maximalism"),
    "memphis":        (REFS_LARK   / "lark_memphis.jpg",         "Graphic & Experimental", "Memphis"),
    "glitch":         (REFS_LARK   / "lark_glitch.jpg",          "Graphic & Experimental", "Glitch Art"),
    "kinetic_typo":   (REFS_LARK   / "lark_kinetic_typo.jpg",    "Graphic & Experimental", "Kinetic Typography"),
    "surreal_3d":     (REFS_LARK   / "lark_surreal_3d.jpg",      "Graphic & Experimental", "Surreal 3D"),
    # Retro & Era
    "bauhaus":        (REFS_LARK   / "lark_bauhaus.jpg",         "Retro & Era",            "Bauhaus"),
    "synthwave":      (REFS_LEGACY / "vaporwave.jpg",            "Retro & Era",            "Synthwave"),
    "y2k":            (REFS_LEGACY / "retro90.jpg",              "Retro & Era",            "Y2K Revival"),
    "cassette_fut":   (REFS_LEGACY / "album2.jpg",               "Retro & Era",            "Cassette Futurism"),
    # Organic & Humanistic
    "organic_modern": (REFS_LEGACY / "organic.jpg",              "Organic & Humanistic",   "Organic Modern"),
    "biophilic":      (IMAGES_DIR / "styles" / "biophilic" / "preview.jpg", "Organic & Humanistic",   "Biophilic"),
    "wabi_sabi":      (REFS_LEGACY / "editorial4.jpg",           "Organic & Humanistic",   "Wabi-Sabi"),
    "ethereal":       (REFS_LEGACY / "psychedelic2.jpg",         "Organic & Humanistic",   "Ethereal"),
}

RECREATION_PROMPT = """You will receive an aesthetic reference image. The reference image is used only to determine the subject domain, medium type, and non-proprietary aesthetic attributes. It is NOT a target to copy, reproduce, or directly edit.

Generate an original image for a commercial aesthetics library based on the reference image.

[CORE PRINCIPLES]
The recreation must share the same:
- Subject category
- Visual medium type
- Dimensional attribute
- Presentation format

Only innovate within the original domain. Do not convert the reference into a different type of work.

[AESTHETIC STYLE]
Primary category: {category}
Secondary style: {style}

The style influences aesthetic language only — it must NOT change the subject domain.

[TEXT & TYPOGRAPHY RULES]
Do not identify, copy, or transcribe any text from the reference.
If text/typography is NOT the core subject: generate NO text, letters, numbers, brands, or logos.
If typography IS the core subject: generate new letterforms with entirely new content and skeleton.

[COLOR SIMILARITY ~50%]
Retain approximately half the color attributes from the reference:
- Main hue family, warm/cool tendency, light/dark contrast mood
Redesign the other half:
- Shift specific hues, adjust brightness/saturation, change accent colors, alter area ratios

[ORIGINALITY REQUIREMENTS]
Keep the subject domain unchanged. Change at least 6 of these:
- Specific subject/content, internal structure, overall composition, element count/scale/density,
  specific colors and ratios, material/texture/surface, lighting/shadow/depth,
  viewpoint/motion/spatial relations, background/edge crop, information hierarchy/visual rhythm

[4:3 OUTPUT SPEC]
- Native 4:3 horizontal composition
- Minimum 1536×1152
- Reorganize content natively for 4:3 — do NOT crop from 16:9
- No stretching, no compression, no black/white borders, no device frames
- Keep main subject complete
- Bottom ~25% should be relatively calm (reserved for potential info card overlay)

[PROHIBITED]
- Text, brands, logos, watermarks from reference
- Copyrighted characters or recognizable brand products
- Famous architecture or iconic products directly copied
- Signature style of specific artists/designers/studios
- New scenes or media unrelated to the original domain

Generate one original 4:3 image. After generating, report:
Category: {category}
Style: {style}
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

    # output is a list of FileOutput objects
    if hasattr(output, "__iter__"):
        result = list(output)
        if result:
            img_output = result[0]
        else:
            raise ValueError("Empty output from Replicate")
    else:
        img_output = output

    # Read bytes
    if hasattr(img_output, "read"):
        return img_output.read()
    elif hasattr(img_output, "url"):
        import urllib.request
        with urllib.request.urlopen(img_output.url) as r:
            return r.read()
    else:
        raise ValueError(f"Unknown output type: {type(img_output)}")


def process_style(key: str, dry_run: bool = False) -> bool:
    if key not in STYLES:
        print(f"❌ Unknown style key: {key}")
        print(f"   Available: {', '.join(STYLES.keys())}")
        return False

    src_file, category, style_name = STYLES[key]
    src_path = src_file  # already a Path object

    if not src_path.exists():
        print(f"⚠️  Source not found: {src_path} — skipping")
        return False

    prompt = RECREATION_PROMPT.format(category=category, style=style_name)
    out_path = OUTPUT_DIR / f"tasto_{key}.png"

    print(f"\n{'='*60}")
    print(f"Style:    {style_name} ({category})")
    print(f"Source:   {src_file}")
    print(f"Output:   images/recreated/tasto_{key}.png")

    if dry_run:
        print("\n[DRY RUN] Prompt preview:")
        print(prompt[:400] + "...")
        return True

    cfg = load_config()
    token = cfg.get("replicate_api_token", "")
    if not token:
        print("❌ No Replicate API token in config")
        return False

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

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
    parser = argparse.ArgumentParser(description="TASTO style image recreator")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--style", help="Single style key (e.g. swiss_style)")
    group.add_argument("--all", action="store_true", help="Process all styles")
    parser.add_argument("--dry-run", action="store_true", help="Preview prompt only, no API call")
    parser.add_argument("--delay", type=float, default=3.0, help="Seconds between requests (default 3)")
    args = parser.parse_args()

    if args.style:
        process_style(args.style, dry_run=args.dry_run)
    else:
        keys = list(STYLES.keys())
        print(f"Processing {len(keys)} styles...\n")
        ok = 0
        for i, key in enumerate(keys):
            success = process_style(key, dry_run=args.dry_run)
            if success:
                ok += 1
            if not args.dry_run and i < len(keys) - 1:
                time.sleep(args.delay)
        print(f"\n{'='*60}")
        print(f"Done: {ok}/{len(keys)} succeeded")
        print(f"Output: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
