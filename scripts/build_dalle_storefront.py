#!/usr/bin/env python3
"""Build a Gumroad-ready digital art pack from a ChatGPT DALL·E export."""

from __future__ import annotations

import argparse
import csv
import glob
import json
import re
import shutil
import textwrap
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


DEFAULT_BANNED_TERMS = [
    "image 1 of",
    "image 2 of",
    "image 3 of",
    "image 4 of",
    "image 5 of",
    "image 6 of",
    "image 7 of",
    "post ",
    "logo",
    "mockup",
    "usb flash drive",
    "calling trish",
    "hold timer",
    "phone on a desk",
    "judge breslow",
    "trish",
    "galen carrico",
    "small claims evidence",
    "supermax facility",
    "solitary confinement",
    "roommate",
    "motorcycle keys",
    "cortana",
]

DEFAULT_KEYWORD_BONUS = {
    "courtroom": 8,
    "justice": 8,
    "surreal": 5,
    "neon": 5,
    "graffiti": 5,
    "satirical": 4,
    "rebellious": 4,
    "defiance": 5,
    "corruption": 4,
    "glowing": 3,
    "judge": 2,
    "gavel": 2,
    "chaotic": 2,
    "dystopian": 4,
}


@dataclass(frozen=True)
class ProductPreset:
    slug: str
    title: str
    subtitle: str
    tags: list[str]
    pricing: dict[str, int]
    title_quotas: dict[str, int]
    keyword_bonus: dict[str, int]
    banned_terms: list[str]
    positioning: str
    buyer_gets: list[str]
    best_for: list[str]
    cover_line: str


PRESETS: dict[str, ProductPreset] = {
    "system-glitch": ProductPreset(
        slug="system-glitch-wallpaper-pack",
        title="System Glitch: 25 Dystopian Courtroom Rebellion Wallpapers",
        subtitle="A direct-download art pack built from the strongest legal-surreal images in the DALL·E archive.",
        tags=[
            "dystopian wallpaper",
            "courtroom art",
            "legal satire",
            "cyberpunk justice",
            "rebellion art",
            "digital poster",
            "activist art",
            "surreal courtroom",
            "desktop wallpaper",
            "gumroad digital art",
        ],
        pricing={"personal_usd": 12, "commercial_usd": 29, "extended_usd": 79},
        title_quotas={
            "Corrupt Legal System Imagery": 10,
            "Sealed Justice System": 7,
            "Courtroom Graffiti Sequence": 5,
            "Justice Casino AI Revolution": 3,
        },
        keyword_bonus=DEFAULT_KEYWORD_BONUS,
        banned_terms=DEFAULT_BANNED_TERMS,
        positioning="A niche digital art pack for people who want courtroom dystopia, anti-bureaucratic rebellion, and neon legal satire without commissioning custom work.",
        buyer_gets=[
            "25 curated PNG wallpapers converted from the DALL·E archive",
            "1792x1024 source resolution artwork suitable for desktop wallpaper and digital poster use",
            "Cover art and contact sheet for listing previews",
            "A zipped download plus per-image catalog metadata",
        ],
        best_for=[
            "desktops",
            "decks",
            "creative moodboards",
            "posters",
            "thumbnails",
            "digital environments that need anti-bureaucratic energy",
        ],
        cover_line="25 high-resolution PNG wallpapers for desktop, poster, and direct-download art bundles.",
    ),
    "constitutional-comedy": ProductPreset(
        slug="constitutional-comedy-poster-pack",
        title="Constitutional Comedy: 30 Satirical Freedom Posters",
        subtitle="A punchier direct-download poster pack built from the strongest anti-bureaucratic comedy images in the archive.",
        tags=[
            "satirical poster",
            "political comedy art",
            "freedom poster",
            "constitutional satire",
            "rebellion artwork",
            "digital poster pack",
            "wall art download",
            "gumroad poster pack",
            "activist art",
            "weird americana",
        ],
        pricing={"personal_usd": 14, "commercial_usd": 34, "extended_usd": 89},
        title_quotas={"Audit of Constitutional Comedy": 30},
        keyword_bonus={
            **DEFAULT_KEYWORD_BONUS,
            "comedy": 8,
            "poster": 6,
            "absurd": 5,
            "constitutional": 7,
            "campaign": 4,
            "americana": 4,
            "satirical": 7,
        },
        banned_terms=DEFAULT_BANNED_TERMS
        + [
            "passport style",
            "headshot",
            "business card",
            "photo booth",
            "website mockup",
            "youtube thumbnail layout",
        ],
        positioning="A satirical poster pack for people who want loud anti-bureaucratic art, weird Americana, and constitutional-comedy energy without designing it from scratch.",
        buyer_gets=[
            "30 curated PNG poster-style images from the constitutional comedy archive",
            "Ready-to-use digital art for desktops, prints, cover art, and creator backdrops",
            "A contact sheet and cover image for instant merchandising",
            "A zipped download plus per-image catalog metadata",
        ],
        best_for=[
            "digital posters",
            "creator backdrops",
            "substack headers",
            "album-cover mockups",
            "moodboards",
            "printable wall art with a satirical streak",
        ],
        cover_line="30 surreal anti-bureaucratic poster images for creators, prints, headers, and direct-download art bundles.",
    ),
}


@dataclass
class ImageEntry:
    conversation_title: str
    conversation_id: str
    file_id: str
    gen_id: str | None
    prompt: str
    width: int | None
    height: int | None
    create_time: float | None
    source_path: Path
    score: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--export-root", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--preset", choices=sorted(PRESETS.keys()), default="system-glitch")
    return parser.parse_args()


def load_image_entries(export_root: Path, preset: ProductPreset) -> list[ImageEntry]:
    file_map = {}
    for path_str in glob.glob(str(export_root / "dalle-generations" / "file-*.webp")):
        path = Path(path_str)
        match = re.match(r"^(file-[A-Za-z0-9]+)-[0-9a-f-]{36}\.webp$", path.name)
        if not match:
            continue
        file_id = match.group(1)
        file_map[file_id] = path

    entries: list[ImageEntry] = []
    for convo_path in sorted((export_root / "raw_data").glob("conversations-*.json")):
        with convo_path.open() as handle:
            conversations = json.load(handle)
        for convo in conversations:
            title = convo.get("title") or "Untitled"
            if title not in preset.title_quotas:
                continue
            mapping = convo.get("mapping") or {}
            for node in mapping.values():
                msg = node.get("message") or {}
                parts = ((msg.get("content") or {}).get("parts") or [])
                for part in parts:
                    if not isinstance(part, dict) or part.get("content_type") != "image_asset_pointer":
                        continue
                    dalle = ((part.get("metadata") or {}).get("dalle") or {})
                    prompt = (dalle.get("prompt") or "").strip()
                    file_id = (part.get("asset_pointer") or "").replace("file-service://", "")
                    if not prompt or not file_id:
                        continue
                    source_path = file_map.get(file_id)
                    if source_path is None or not source_path.exists():
                        continue
                    score = score_prompt(preset, title, prompt, part.get("width"), part.get("height"))
                    if score < 0:
                        continue
                    entries.append(
                        ImageEntry(
                            conversation_title=title,
                            conversation_id=convo.get("id", ""),
                            file_id=file_id,
                            gen_id=dalle.get("gen_id"),
                            prompt=prompt,
                            width=part.get("width"),
                            height=part.get("height"),
                            create_time=msg.get("create_time"),
                            source_path=source_path,
                            score=score,
                        )
                    )
    return entries


def score_prompt(preset: ProductPreset, title: str, prompt: str, width: int | None, height: int | None) -> int:
    lowered = prompt.lower()
    if any(term in lowered for term in preset.banned_terms):
        return -1
    score = 20
    if width and height and width > height:
        score += 8
    if "16:9" in lowered:
        score += 8
    for word, bonus in preset.keyword_bonus.items():
        if word in lowered:
            score += bonus
    if title == "Corrupt Legal System Imagery":
        score += 6
    if title == "Sealed Justice System":
        score += 4
    if title == "Courtroom Graffiti Sequence":
        score += 5
    if title == "Justice Casino AI Revolution":
        score += 3
    return score


def select_entries(entries: Iterable[ImageEntry], preset: ProductPreset) -> list[ImageEntry]:
    by_title: dict[str, list[ImageEntry]] = defaultdict(list)
    for entry in entries:
        by_title[entry.conversation_title].append(entry)

    selected: list[ImageEntry] = []
    seen_paths: set[Path] = set()
    seen_prompts: set[str] = set()
    for title, quota in preset.title_quotas.items():
        candidates = sorted(by_title[title], key=lambda item: (-item.score, item.create_time or 0, item.file_id))
        taken = 0
        for entry in candidates:
            normalized_prompt = re.sub(r"\s+", " ", entry.prompt.strip().lower())
            if entry.source_path in seen_paths:
                continue
            if normalized_prompt in seen_prompts:
                continue
            selected.append(entry)
            seen_paths.add(entry.source_path)
            seen_prompts.add(normalized_prompt)
            taken += 1
            if taken >= quota:
                break
    return selected


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "artwork"


def build_title(prompt: str, index: int) -> str:
    lowered = prompt.lower()
    title_rules = [
        ("magic 8 ball", "Objection by 8 Ball"),
        ("rubber chicken", "Funhouse Bench"),
        ("squeaky toy gavel", "Squeaky Gavel Court"),
        ("justice won", "Justice Won"),
        ("spray-painting a massive wall", "Paint the Bench"),
        ("crumbling courtroom suspended over a dark abyss", "Edge of Survival"),
        ("towering courtroom", "Graffiti at the Courthouse"),
        ("constitutional violations", "Constitution Torn Open"),
        ("$25,000 bail", "Price of Punishment"),
        ("rare moment of justice", "Rare Light"),
        ("motion to dismiss", "Motion to Dismiss"),
        ("rigged legal process", "Rigged Process"),
        ("continuance", "Continuance Web"),
        ("eye floating in a dark, surreal void", "Witness Eye"),
        ("viking resilience", "Rune Shield"),
        ("clown-like distortions", "Circus Bench"),
        ("dmt trip", "Psychedelic Trial"),
        ("lsd, dmt, thc legality", "Altered-State Hearing"),
        ("chains spread out", "Web of Control"),
        ("glowing shield", "Shield Against Corruption"),
        ("glowing document labeled 'motion to dismiss'", "Motion to Dismiss"),
        ("justice breaking through constraints", "Break the Chain"),
    ]
    for needle, title in title_rules:
        if needle in lowered:
            return title

    titled = re.search(r"titled ['\"]([^'\"]+)['\"]", prompt, re.IGNORECASE)
    if titled:
        return titled.group(1).strip()

    cleaned = re.sub(r"^image \d+ of \d+ for post \d+:\s*", "", prompt, flags=re.IGNORECASE)
    cleaned = re.sub(
        r"^(a|an)\s+(16:9\s+)?"
        r"(digital painting|digital illustration|surreal (and modern )?depiction|surreal scene|"
        r"surreal courtroom scene|satirical courtroom scene|hyper-realistic depiction|"
        r"dystopian artistic depiction|dark and cynical scene|rugged, graffiti-style artwork|"
        r"urban graffiti-style artwork|digital merchandise mockup)\s+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    for marker in ["depicting ", "showing ", "symbolizing ", "representing ", "featuring "]:
        idx = cleaned.lower().find(marker)
        if idx != -1:
            cleaned = cleaned[idx + len(marker) :]
            break
    cleaned = re.split(r"[,.]", cleaned, 1)[0]
    cleaned = re.sub(r"\bthe protagonist\b", "the defendant", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -")
    words = cleaned.split()
    if len(words) > 8:
        cleaned = " ".join(words[:8])
    cleaned = cleaned.strip()
    if not cleaned:
        return f"System Glitch {index:02d}"
    return cleaned.title()


def build_description(prompt: str) -> str:
    prompt = re.sub(r"\s+", " ", prompt).strip()
    prompt = re.sub(r"^Image \d+ of \d+ for Post \d+:\s*", "", prompt, flags=re.IGNORECASE)
    return textwrap.shorten(prompt, width=240, placeholder="...")


def build_tags(prompt: str) -> str:
    controlled = [
        "courtroom",
        "justice",
        "surreal",
        "neon",
        "graffiti",
        "satire",
        "rebellion",
        "dystopian",
        "activist",
        "glitch",
        "legal",
    ]
    lowered = prompt.lower()
    tags = [tag for tag in controlled if tag in lowered]
    return ", ".join(tags[:6])


def ensure_clean_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def convert_images(selected: list[ImageEntry], product_images_dir: Path) -> list[dict]:
    product_rows = []
    for index, entry in enumerate(selected, start=1):
        title = build_title(entry.prompt, index)
        slug = slugify(title)
        output_name = f"{index:02d}-{slug}.png"
        output_path = product_images_dir / output_name
        with Image.open(entry.source_path) as image:
            rgb = image.convert("RGB")
            rgb.save(output_path, "PNG", optimize=True)
        product_rows.append(
            {
                "index": index,
                "sku": f"SGWP-{index:02d}",
                "title": title,
                "file_name": output_name,
                "source_file": entry.source_path.name,
                "conversation_title": entry.conversation_title,
                "prompt": entry.prompt,
                "description": build_description(entry.prompt),
                "tags": build_tags(entry.prompt),
                "width": entry.width or "",
                "height": entry.height or "",
            }
        )
    ensure_unique_titles(product_rows)
    return product_rows


def ensure_unique_titles(rows: list[dict]) -> None:
    seen: dict[str, int] = {}
    numerals = ["II", "III", "IV", "V"]
    for row in rows:
        title = row["title"]
        count = seen.get(title, 0) + 1
        seen[title] = count
        if count == 1:
            continue
        suffix = numerals[count - 2] if count - 2 < len(numerals) else str(count)
        row["title"] = f"{title} {suffix}"


def draw_cover(product_images_dir: Path, preview_dir: Path, preset: ProductPreset) -> None:
    image_paths = sorted(product_images_dir.glob("*.png"))[:4]
    if not image_paths:
        return
    images = [Image.open(path).convert("RGB").resize((800, 450)) for path in image_paths]
    canvas = Image.new("RGB", (1600, 900), (10, 12, 20))
    positions = [(0, 0), (800, 0), (0, 450), (800, 450)]
    for image, pos in zip(images, positions):
        canvas.paste(image, pos)

    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((0, 580, 1600, 900), fill=(0, 0, 0, 150))
    title_font = ImageFont.load_default()
    small_font = ImageFont.load_default()
    draw.text((60, 635), preset.title, fill=(255, 255, 255, 255), font=title_font)
    draw.text((60, 700), preset.cover_line, fill=(225, 225, 225, 255), font=small_font)
    merged = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")
    merged.save(preview_dir / "cover-grid.jpg", quality=92)

    for image in images:
        image.close()


def draw_contact_sheet(product_images_dir: Path, preview_dir: Path) -> None:
    image_paths = sorted(product_images_dir.glob("*.png"))
    if not image_paths:
        return
    thumbs = []
    for path in image_paths:
        with Image.open(path) as image:
            thumbs.append(image.convert("RGB").resize((320, 180)))
    cols = 5
    rows = 5
    canvas = Image.new("RGB", (cols * 320, rows * 180), (8, 10, 18))
    for idx, thumb in enumerate(thumbs[: cols * rows]):
        x = (idx % cols) * 320
        y = (idx // cols) * 180
        canvas.paste(thumb, (x, y))
    canvas.save(preview_dir / "contact-sheet.jpg", quality=90)


def write_catalog(rows: list[dict], metadata_dir: Path) -> None:
    fieldnames = [
        "index",
        "sku",
        "title",
        "file_name",
        "source_file",
        "conversation_title",
        "description",
        "tags",
        "width",
        "height",
        "prompt",
    ]
    with (metadata_dir / "catalog.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    with (metadata_dir / "catalog.json").open("w") as handle:
        json.dump(rows, handle, indent=2)


def write_product_files(output_dir: Path, rows: list[dict], preset: ProductPreset) -> None:
    gumroad_dir = output_dir / "gumroad"
    metadata_dir = output_dir / "metadata"
    product_dir = output_dir / "product"
    preview_dir = output_dir / "preview"

    bundle_path = output_dir / f"{preset.slug}.zip"
    with zipfile.ZipFile(bundle_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(product_dir.glob("*.png")):
            archive.write(path, arcname=path.name)

    product_json = {
        "slug": preset.slug,
        "title": preset.title,
        "subtitle": preset.subtitle,
        "suggested_pricing_usd": preset.pricing,
        "platform": "Gumroad",
        "tags": preset.tags,
        "bundle_zip": bundle_path.name,
        "cover_image": "preview/cover-grid.jpg",
        "contact_sheet": "preview/contact-sheet.jpg",
        "asset_count": len(rows),
    }
    with (gumroad_dir / "product.json").open("w") as handle:
        json.dump(product_json, handle, indent=2)

    highlights = "\n".join(f"- {row['title']}: {row['description']}" for row in rows[:8])
    with (gumroad_dir / "product-copy.md").open("w") as handle:
        handle.write(
            f"# {preset.title}\n\n"
            f"{preset.subtitle}\n\n"
            "## Positioning\n\n"
            f"{preset.positioning}\n\n"
            "## What buyers get\n\n"
            + "\n".join(f"- {item}" for item in preset.buyer_gets)
            + "\n\n"
            "## Suggested pricing\n\n"
            f"- Personal use: ${preset.pricing['personal_usd']}\n"
            f"- Commercial/content license: ${preset.pricing['commercial_usd']}\n"
            f"- Extended/internal team license: ${preset.pricing['extended_usd']}\n\n"
            "## Suggested Gumroad description\n\n"
            f"{preset.title} is a curated direct-download art pack built from a large DALL·E archive. It turns the strongest visuals into an immediately usable bundle instead of leaving them trapped in old chats.\n\n"
            "Best for "
            + ", ".join(preset.best_for[:-1])
            + f", and {preset.best_for[-1]}.\n\n"
            "## Sample pieces\n\n"
            f"{highlights}\n\n"
            "## Tags\n\n"
            + ", ".join(preset.tags)
            + "\n"
        )

    with (gumroad_dir / "publish-checklist.md").open("w") as handle:
        handle.write(
            "# Publish Checklist\n\n"
            "1. Create one Gumroad digital product.\n"
            "2. Use `preview/cover-grid.jpg` as the main cover image.\n"
            "3. Upload `preview/contact-sheet.jpg` as an additional preview.\n"
            f"4. Upload `{bundle_path.name}` as the product file.\n"
            "5. Paste the copy from `gumroad/product-copy.md`.\n"
            "6. Start with the personal-use price, then add license tiers if you want variants.\n"
            "7. Use the tags listed in `gumroad/product.json`.\n"
            "8. Publish and verify the checkout/download flow.\n"
        )

    with (output_dir / "README.md").open("w") as handle:
        handle.write(
            f"# {preset.title}\n\n"
            f"- Product folder: `{product_dir}`\n"
            f"- Preview folder: `{preview_dir}`\n"
            f"- Metadata: `{metadata_dir}`\n"
            f"- Gumroad assets: `{gumroad_dir}`\n"
            f"- Bundle zip: `{bundle_path}`\n"
        )


def main() -> None:
    args = parse_args()
    export_root = Path(args.export_root).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    preset = PRESETS[args.preset]
    ensure_clean_dir(output_dir)

    product_dir = output_dir / "product"
    preview_dir = output_dir / "preview"
    metadata_dir = output_dir / "metadata"
    gumroad_dir = output_dir / "gumroad"
    for path in [product_dir, preview_dir, metadata_dir, gumroad_dir]:
        path.mkdir(parents=True, exist_ok=True)

    entries = load_image_entries(export_root, preset)
    selected = select_entries(entries, preset)
    rows = convert_images(selected, product_dir)
    draw_cover(product_dir, preview_dir, preset)
    draw_contact_sheet(product_dir, preview_dir)
    write_catalog(rows, metadata_dir)
    write_product_files(output_dir, rows, preset)

    summary = {
        "preset": args.preset,
        "product_title": preset.title,
        "product_slug": preset.slug,
        "selected_count": len(rows),
        "output_dir": str(output_dir),
        "titles": [row["title"] for row in rows],
    }
    with (output_dir / "summary.json").open("w") as handle:
        json.dump(summary, handle, indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
