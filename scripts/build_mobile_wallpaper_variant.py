#!/usr/bin/env python3
"""Build a portrait mobile-wallpaper product variant from an existing art pack."""

from __future__ import annotations

import argparse
import csv
import json
import shutil
import textwrap
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


TARGET_SIZE = (1440, 2560)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-pack", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--subtitle", required=True)
    parser.add_argument("--price", type=int, default=9)
    parser.add_argument("--gumroad-url", default="")
    return parser.parse_args()


def ensure_clean_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def load_catalog(source_pack: Path) -> list[dict]:
    catalog_path = source_pack / "metadata" / "catalog.csv"
    with catalog_path.open() as handle:
        return list(csv.DictReader(handle))


def crop_to_portrait(source_path: Path, output_path: Path) -> None:
    with Image.open(source_path) as image:
        rgb = image.convert("RGB")
        source_ratio = rgb.width / rgb.height
        target_ratio = TARGET_SIZE[0] / TARGET_SIZE[1]
        if source_ratio > target_ratio:
            crop_width = int(rgb.height * target_ratio)
            left = (rgb.width - crop_width) // 2
            box = (left, 0, left + crop_width, rgb.height)
        else:
            crop_height = int(rgb.width / target_ratio)
            top = max((rgb.height - crop_height) // 2, 0)
            box = (0, top, rgb.width, top + crop_height)
        cropped = rgb.crop(box).resize(TARGET_SIZE, Image.Resampling.LANCZOS)
        cropped.save(output_path, "PNG", optimize=True)


def write_preview(product_dir: Path, preview_dir: Path, title: str) -> None:
    paths = sorted(product_dir.glob("*.png"))[:4]
    if not paths:
        return
    canvas = Image.new("RGB", (1600, 900), (12, 16, 28))
    positions = [(60, 60), (430, 60), (800, 60), (1170, 60)]
    for path, (x, y) in zip(paths, positions):
        with Image.open(path) as image:
            thumb = image.convert("RGB").resize((320, 568))
            canvas.paste(thumb, (x, y))
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((0, 700, 1600, 900), fill=(0, 0, 0, 165))
    font = ImageFont.load_default()
    draw.text((60, 760), title, fill=(255, 255, 255, 255), font=font)
    draw.text((60, 800), "25 portrait PNG wallpapers sized for iPhone, Android, and lock-screen use.", fill=(220, 220, 220, 255), font=font)
    merged = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")
    merged.save(preview_dir / "cover-grid.jpg", quality=92)
    canvas.save(preview_dir / "contact-sheet.jpg", quality=90)


def write_outputs(args: argparse.Namespace, source_pack: Path, output_dir: Path, rows: list[dict]) -> None:
    preview_dir = output_dir / "preview"
    product_dir = output_dir / "product"
    metadata_dir = output_dir / "metadata"
    gumroad_dir = output_dir / "gumroad"
    for path in [preview_dir, product_dir, metadata_dir, gumroad_dir]:
        path.mkdir(parents=True, exist_ok=True)

    converted = []
    for row in rows:
        source_name = row["file_name"]
        source_path = source_pack / "product" / source_name
        output_name = source_name
        output_path = product_dir / output_name
        crop_to_portrait(source_path, output_path)
        converted.append({**row, "file_name": output_name, "variant": "portrait-mobile"})

    write_preview(product_dir, preview_dir, args.title)

    with (metadata_dir / "catalog.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(converted[0].keys()))
        writer.writeheader()
        writer.writerows(converted)
    (metadata_dir / "catalog.json").write_text(json.dumps(converted, indent=2))

    bundle_path = output_dir / f"{args.slug}.zip"
    with zipfile.ZipFile(bundle_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(product_dir.glob("*.png")):
            archive.write(path, arcname=path.name)

    highlights = "\n".join(
        f"- {row['title']}: {textwrap.shorten(row['description'], width=180, placeholder='...')}"
        for row in converted[:8]
    )
    product_json = {
        "slug": args.slug,
        "title": args.title,
        "subtitle": args.subtitle,
        "suggested_pricing_usd": {
            "personal_usd": args.price,
            "commercial_usd": args.price + 15,
            "extended_usd": args.price + 45,
        },
        "platform": "Gumroad",
        "tags": [
            "phone wallpaper",
            "mobile wallpaper pack",
            "lock screen art",
            "cyberpunk wallpaper",
            "surreal phone background",
            "gumroad wallpaper",
        ],
        "bundle_zip": bundle_path.name,
        "cover_image": "preview/cover-grid.jpg",
        "contact_sheet": "preview/contact-sheet.jpg",
        "asset_count": len(converted),
        "gumroad_url": args.gumroad_url,
    }
    (gumroad_dir / "product.json").write_text(json.dumps(product_json, indent=2))
    (gumroad_dir / "product-copy.md").write_text(
        f"# {args.title}\n\n"
        f"{args.subtitle}\n\n"
        "## Positioning\n\n"
        "A mobile-first wallpaper pack for buyers who want surreal anti-bureaucratic artwork that actually fits a phone screen instead of a desktop monitor.\n\n"
        "## What buyers get\n\n"
        "- 25 portrait PNG wallpapers cropped and optimized for phones\n"
        "- 1440x2560 output size for iPhone and Android lock screens\n"
        "- A zipped download plus catalog metadata\n"
        "- Cover image and contact sheet ready for listing use\n\n"
        "## Suggested pricing\n\n"
        f"- Personal use: ${args.price}\n"
        f"- Commercial/content license: ${args.price + 15}\n"
        f"- Extended/internal team license: ${args.price + 45}\n\n"
        "## Suggested Gumroad description\n\n"
        f"{args.title} repackages the strongest images from the System Glitch archive into a phone-first format. Instead of making buyers crop the art themselves, this bundle ships ready for lock screens, homescreens, and creator device mockups.\n\n"
        "## Sample pieces\n\n"
        f"{highlights}\n"
    )
    (output_dir / "summary.json").write_text(
        json.dumps(
            {
                "product_title": args.title,
                "product_slug": args.slug,
                "selected_count": len(converted),
                "output_dir": str(output_dir),
            },
            indent=2,
        )
    )


def main() -> None:
    args = parse_args()
    source_pack = Path(args.source_pack).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    ensure_clean_dir(output_dir)
    rows = load_catalog(source_pack)
    write_outputs(args, source_pack, output_dir, rows)
    print((output_dir / "summary.json").read_text())


if __name__ == "__main__":
    main()
