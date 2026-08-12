#!/usr/bin/env python3
"""
TASTO Vibe Card — Local Pillow renderer (zero API cost)
========================================================
Draws a frosted-glass info card on the bottom of each recreated image.
Uses Pillow only — no API calls.

Usage:
    python3 scripts/add_card_local.py --all
    python3 scripts/add_card_local.py --style swiss_style
"""

from __future__ import annotations
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

RECREATED_DIR = Path(__file__).parent.parent / "images" / "recreated"
CARD_DIR      = Path(__file__).parent.parent / "images" / "recreated_card"

STYLE_META = {
    "swiss_style":        ("Minimal & Modern",       "Swiss Style",          "Grid, Typography, Geometry",          "Red, Black, White, Yellow",          "Flat, Crisp, Structured"),
    "editorial_min":      ("Minimal & Modern",       "Editorial Minimal",    "White Space, Type, Layout",           "Ivory, Charcoal, Stone, Ink",        "Clean, Refined, Airy"),
    "tech_min":           ("Minimal & Modern",       "Tech Minimal",         "Grid, Line, Interface",               "White, Silver, Black, Blue",         "Crisp, Precise, Digital"),
    "warm_min":           ("Minimal & Modern",       "Warm Minimal",         "Organic, Space, Softness",            "Sand, Cream, Terracotta, Stone",     "Matte, Tactile, Calm"),
    "luxury_min":         ("Minimal & Modern",       "Luxury Minimal",       "Proportion, Restraint, Elegance",     "Ivory, Gold, Obsidian, Taupe",       "Satin, Polished, Premium"),
    "velvet_luxe":        ("Minimal & Modern",       "Velvet Luxe",          "Serif, Emblem, Restraint",            "Emerald, Gold, Forest, Ivory",       "Velvet, Gilded, Opulent"),
    "monochrome":         ("Minimal & Modern",       "Monochrome",           "Tone, Contrast, Depth",               "Black, White, Mid-Gray, Shadow",     "High-Contrast, Stark, Graphic"),
    "glassmorphism":      ("Material & Space",       "Glassmorphism",        "Transparency, Layer, Blur",           "Frost, Ice Blue, Lavender, White",   "Translucent, Soft, Luminous"),
    "paper_cutout":       ("Material & Space",       "Paper / Cutout",       "Layer, Shadow, Craft",                "Cream, Blush, Sage, Peach",          "Tactile, Handmade, Dimensional"),
    "cyberpunk":          ("Futuristic & Sci-Fi",    "Cyberpunk",            "Neon, Circuit, Urban",                "Cyan, Magenta, Black, Purple",       "Glow, Glitch, Chrome"),
    "dark_tech":          ("Futuristic & Sci-Fi",    "Dark Technology",      "Data, Grid, Interface",               "Obsidian, Neon Green, Steel, Void",  "Matte Black, Sharp, Technical"),
    "scifi_hud":          ("Futuristic & Sci-Fi",    "Sci-Fi HUD",           "HUD, Overlay, Data Viz",              "Electric Blue, Orange, Black, Teal", "Holographic, Precise, Futuristic"),
    "cinematic":          ("Cinematic & Narrative",  "Cinematic Dark",       "Atmosphere, Light, Scene",            "Deep Brown, Gold, Amber, Shadow",    "Film Grain, Moody, Rich"),
    "film_noir":          ("Cinematic & Narrative",  "Film Noir",            "Silhouette, Shadow, Drama",           "Black, Silver, Deep Gray, White",    "High-Contrast, Grainy, Tense"),
    "cinematic_editorial":("Cinematic & Narrative",  "Cinematic Editorial",  "Frame, Narrative, Composition",       "Muted Teal, Rust, Cream, Black",     "Cinematic, Graded, Intentional"),
    "neo_brutalism":      ("Graphic & Experimental", "Neo-Brutalism",        "Bold, Raw, Offset",                   "Yellow, Black, White, Red",          "Thick Border, Harsh, Unapologetic"),
    "anti_design":        ("Graphic & Experimental", "Anti-Design",          "Collage, Clash, Disruption",          "Clash, Neon, Dirt, Acid",            "Torn, Layered, Unfinished"),
    "maximalism":         ("Graphic & Experimental", "Maximalism",           "Pattern, Abundance, Density",         "Jewel, Gold, Crimson, Emerald",      "Ornate, Rich, Layered"),
    "memphis":            ("Graphic & Experimental", "Memphis",              "Shape, Pattern, Play",                "Pink, Teal, Yellow, Black",          "Flat, Playful, Graphic"),
    "glitch":             ("Graphic & Experimental", "Glitch Art",           "Distortion, Artifact, Error",         "Electric Blue, Red, Green, Black",   "Corrupted, Digital, Fragmented"),
    "kinetic_typo":       ("Graphic & Experimental", "Kinetic Typography",   "Motion, Letterform, Rhythm",          "Black, White, Accent Red, Gray",     "Dynamic, Bold, Expressive"),
    "surreal_3d":         ("Graphic & Experimental", "Surreal 3D",           "Fluid, Sculpture, Dreamscape",        "Iridescent, Pastel, Deep Shadow",    "Glass, Render, Ethereal"),
    "bauhaus":            ("Retro & Era",            "Bauhaus",              "Primary Shapes, Balance, Function",   "Red, Yellow, Blue, Black",           "Flat, Geometric, Bold"),
    "synthwave":          ("Retro & Era",            "Synthwave",            "Grid, Horizon, Neon",                 "Purple, Magenta, Cyan, Black",       "Glow, Retro-Digital, Gradient"),
    "y2k":                ("Retro & Era",            "Y2K Revival",          "Chrome, Bubble, Futurism",            "Silver, Baby Blue, Pink, White",     "Glossy, Metallic, Playful"),
    "cassette_fut":       ("Retro & Era",            "Cassette Futurism",    "Panel, Analog, Texture",              "Beige, Orange, Brown, Cream",        "Worn, Retro-Tech, Tactile"),
    "organic_modern":     ("Organic & Humanistic",   "Organic Modern",       "Curve, Nature, Form",                 "Warm White, Sage, Clay, Oak",        "Natural, Breathing, Warm"),
    "biophilic":          ("Organic & Humanistic",   "Biophilic",            "Leaf, Light, Growth",                 "Forest Green, Earth, Sky, Moss",     "Organic, Alive, Textured"),
    "wabi_sabi":          ("Organic & Humanistic",   "Wabi-Sabi",            "Imperfection, Void, Age",             "Ash, Rust, Linen, Fog",              "Worn, Quiet, Impermanent"),
    "ethereal":           ("Organic & Humanistic",   "Ethereal",             "Mist, Light, Float",                  "Blush, Lavender, Pearl, Cloud",      "Soft, Dreamy, Luminous"),
}


def get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates_bold = [
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ]
    candidates_reg = [
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    candidates = candidates_bold if bold else candidates_reg
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def sample_bottom_color(img: Image.Image) -> tuple[int, int, int]:
    """Sample average color from bottom 25% of image."""
    w, h = img.size
    region = img.crop((0, int(h * 0.75), w, h)).convert("RGB")
    region = region.resize((20, 10), Image.LANCZOS)
    pixels = list(region.getdata())
    r = sum(p[0] for p in pixels) // len(pixels)
    g = sum(p[1] for p in pixels) // len(pixels)
    b = sum(p[2] for p in pixels) // len(pixels)
    return (r, g, b)


def is_dark(r: int, g: int, b: int) -> bool:
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    return lum < 128


def add_card(key: str) -> bool:
    if key not in STYLE_META:
        print(f"⚠️  Unknown key: {key}")
        return False

    src = RECREATED_DIR / f"tasto_{key}.png"
    if not src.exists():
        print(f"⚠️  Missing: {src.name} — skipping")
        return False

    category, style_name, form, color, finish = STYLE_META[key]
    out = CARD_DIR / f"tasto_{key}_card.png"
    CARD_DIR.mkdir(parents=True, exist_ok=True)

    img = Image.open(src).convert("RGBA")
    W, H = img.size

    # ── Card geometry (23% height, 94% width, 3% margins) ────────────────────
    card_h    = int(H * 0.23)
    card_w    = int(W * 0.94)
    margin_x  = (W - card_w) // 2
    margin_b  = int(H * 0.03)
    card_y    = H - card_h - margin_b
    radius    = 20

    # ── Glass color from image bottom ────────────────────────────────────────
    base_r, base_g, base_b = sample_bottom_color(img.convert("RGB"))
    dark_bottom = is_dark(base_r, base_g, base_b)

    # Desaturate toward neutral, keep a hint of the base hue
    def mix(a, b, t): return int(a * (1 - t) + b * t)
    neutral = 200 if dark_bottom else 40
    gr, gg, gb = (mix(base_r, neutral, 0.5),
                  mix(base_g, neutral, 0.5),
                  mix(base_b, neutral, 0.5))
    glass_alpha = 210  # ~82% opacity — solid enough to read text

    text_color  = (245, 243, 238) if dark_bottom else (18, 16, 14)
    label_color = (180, 178, 174) if dark_bottom else (90, 88, 84)
    accent_col  = (232, 255, 71)  if dark_bottom else (100, 120, 0)

    # ── Blur the region behind the card ──────────────────────────────────────
    blur_region = img.crop((margin_x, card_y, margin_x + card_w, card_y + card_h))
    blur_region = blur_region.filter(ImageFilter.GaussianBlur(radius=12))
    img.paste(blur_region, (margin_x, card_y))

    # ── Draw rounded-rect glass overlay ──────────────────────────────────────
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle(
        [margin_x, card_y, margin_x + card_w, card_y + card_h],
        radius=radius,
        fill=(gr, gg, gb, glass_alpha),
    )
    # 1px border
    border_alpha = 60
    od.rounded_rectangle(
        [margin_x, card_y, margin_x + card_w, card_y + card_h],
        radius=radius,
        outline=(255, 255, 255, border_alpha),
        width=1,
    )
    img = Image.alpha_composite(img, overlay)
    draw = ImageDraw.Draw(img)

    # ── Typography ────────────────────────────────────────────────────────────
    pad_x = int(card_w * 0.05)
    pad_y = int(card_h * 0.13)
    left_x  = margin_x + pad_x
    right_x = margin_x + int(card_w * 0.42)
    text_y  = card_y + pad_y

    # Font sizes relative to image height
    sz_title = max(48, int(H * 0.052))
    sz_cat   = max(22, int(H * 0.025))
    sz_label = max(24, int(H * 0.027))
    sz_val   = max(24, int(H * 0.027))

    fn_title = get_font(sz_title, bold=True)
    fn_cat   = get_font(sz_cat,   bold=False)
    fn_label = get_font(sz_label, bold=True)
    fn_val   = get_font(sz_val,   bold=False)

    # LEFT: style name + category
    draw.text((left_x, text_y), style_name, font=fn_title, fill=text_color)
    cat_y = text_y + sz_title + int(H * 0.008)
    draw.text((left_x, cat_y), category.upper(), font=fn_cat, fill=label_color)

    # RIGHT: FORM / COLOR / FINISH rows
    row_gap   = int(card_h * 0.27)
    label_w   = int(W * 0.062)  # fixed label column width

    rows = [("FORM", form), ("COLOR", color), ("FINISH", finish)]
    for i, (lbl, val) in enumerate(rows):
        ry = text_y + i * row_gap
        draw.text((right_x, ry),            lbl,       font=fn_label, fill=accent_col)
        draw.text((right_x + label_w, ry),  "  " + val, font=fn_val,   fill=text_color)

    # ── Save ─────────────────────────────────────────────────────────────────
    img.convert("RGB").save(out, "PNG", optimize=True)
    size_kb = out.stat().st_size // 1024
    print(f"  ✅ {key:25s} → {out.name} ({size_kb}KB)")
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--style",  help="Single style key")
    parser.add_argument("--all",    action="store_true")
    args = parser.parse_args()

    keys = [args.style] if args.style else list(STYLE_META.keys())
    ok = sum(add_card(k) for k in keys)
    print(f"\nDone: {ok}/{len(keys)}")


if __name__ == "__main__":
    main()
