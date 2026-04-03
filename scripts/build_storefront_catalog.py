#!/usr/bin/env python3
"""Build a lightweight storefront page from generated Gumroad pack artifacts."""

from __future__ import annotations

import argparse
import csv
import html
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts-root", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--title", default="Artificially Educated Store")
    parser.add_argument("--subtitle", default="Direct-download digital products built from the archive.")
    return parser.parse_args()


def discover_products(artifacts_root: Path) -> list[dict]:
    products: list[dict] = []
    for product_json_path in sorted(artifacts_root.glob("*/gumroad/product.json")):
        product_dir = product_json_path.parent.parent
        data = json.loads(product_json_path.read_text())
        data["artifact_dir"] = str(product_dir)
        data["product_copy_path"] = str(product_dir / "gumroad" / "product-copy.md")
        data["cover_path"] = str(product_dir / data["cover_image"])
        data["contact_sheet_path"] = str(product_dir / data["contact_sheet"])
        data["bundle_path"] = str(product_dir / data["bundle_zip"])
        data["sample_titles"] = read_sample_titles(product_dir / "metadata" / "catalog.csv")
        products.append(data)
    return products


def read_sample_titles(catalog_path: Path) -> list[str]:
    if not catalog_path.exists():
        return []
    titles: list[str] = []
    with catalog_path.open() as handle:
        for row in csv.DictReader(handle):
            title = (row.get("title") or "").strip()
            if title:
                titles.append(title)
            if len(titles) >= 4:
                break
    return titles


def product_card(product: dict) -> str:
    title = html.escape(product["title"])
    subtitle = html.escape(product.get("subtitle") or "")
    tags = "".join(f"<span class='tag'>{html.escape(tag)}</span>" for tag in product.get("tags") or [])
    prices = product.get("suggested_pricing_usd") or {}
    samples = "".join(f"<li>{html.escape(item)}</li>" for item in product.get("sample_titles") or [])
    gumroad_url = html.escape(product.get("gumroad_url") or "#")
    return f"""
    <article class="card">
      <img class="cover" src="{html.escape(product['cover_path'])}" alt="{title}">
      <div class="card-body">
        <p class="eyebrow">{product.get('asset_count', 0)} assets</p>
        <h2>{title}</h2>
        <p class="subtitle">{subtitle}</p>
        <div class="price-row">
          <span>${prices.get('personal_usd', '')} personal</span>
          <span>${prices.get('commercial_usd', '')} commercial</span>
          <span>${prices.get('extended_usd', '')} extended</span>
        </div>
        <div class="tags">{tags}</div>
        <ul class="samples">{samples}</ul>
        <div class="actions">
          <a class="button" href="{gumroad_url}">Buy on Gumroad</a>
          <a class="button button-secondary" href="{html.escape(product['bundle_path'])}">Inspect bundle</a>
        </div>
      </div>
    </article>
    """


def build_html(title: str, subtitle: str, products: list[dict]) -> str:
    cards = "\n".join(product_card(product) for product in products)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)}</title>
  <style>
    :root {{
      --bg: #0b1020;
      --panel: #141c34;
      --panel-2: #0f1730;
      --text: #eef2ff;
      --muted: #a8b2d1;
      --accent: #8bf18f;
      --accent-2: #6dd3ff;
      --border: rgba(255,255,255,0.08);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      background:
        radial-gradient(circle at top left, rgba(109, 211, 255, 0.18), transparent 28%),
        radial-gradient(circle at top right, rgba(139, 241, 143, 0.14), transparent 24%),
        linear-gradient(180deg, #060913, var(--bg));
      color: var(--text);
    }}
    .shell {{ max-width: 1180px; margin: 0 auto; padding: 56px 24px 80px; }}
    .hero {{
      padding: 32px;
      border: 1px solid var(--border);
      border-radius: 28px;
      background: linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));
      box-shadow: 0 24px 80px rgba(0,0,0,0.35);
    }}
    .kicker {{ color: var(--accent); text-transform: uppercase; letter-spacing: 0.16em; font-size: 12px; }}
    h1 {{ font-size: clamp(38px, 6vw, 76px); line-height: 0.95; margin: 12px 0 16px; max-width: 10ch; }}
    .hero p {{ color: var(--muted); max-width: 68ch; font-size: 18px; line-height: 1.6; }}
    .stats {{ display: flex; flex-wrap: wrap; gap: 18px; margin-top: 28px; }}
    .stat {{
      padding: 14px 18px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: rgba(255,255,255,0.02);
    }}
    .catalog {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
      margin-top: 32px;
    }}
    .card {{
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 24px;
      background: linear-gradient(180deg, var(--panel), var(--panel-2));
      box-shadow: 0 16px 48px rgba(0,0,0,0.28);
    }}
    .cover {{ width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; }}
    .card-body {{ padding: 22px; }}
    .eyebrow {{ color: var(--accent-2); font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; margin: 0 0 10px; }}
    h2 {{ margin: 0 0 10px; font-size: 28px; line-height: 1.1; }}
    .subtitle {{ color: var(--muted); min-height: 72px; }}
    .price-row {{
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 16px 0;
      color: var(--accent);
      font-size: 14px;
    }}
    .tags {{ display: flex; flex-wrap: wrap; gap: 8px; }}
    .tag {{
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.06);
      color: var(--muted);
      font-size: 12px;
    }}
    .samples {{ color: var(--muted); line-height: 1.5; padding-left: 18px; min-height: 104px; }}
    .actions {{ display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }}
    .button {{
      display: inline-block;
      padding: 12px 16px;
      border-radius: 14px;
      text-decoration: none;
      color: #08101f;
      background: var(--accent);
      font-weight: 700;
    }}
    .button-secondary {{
      background: transparent;
      color: var(--text);
      border: 1px solid var(--border);
    }}
    .footer {{ margin-top: 24px; color: var(--muted); font-size: 14px; }}
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div class="kicker">Archive to Storefront</div>
      <h1>{html.escape(title)}</h1>
      <p>{html.escape(subtitle)}</p>
      <div class="stats">
        <div class="stat"><strong>{len(products)}</strong> live direct-buy packs</div>
        <div class="stat"><strong>{sum(product.get('asset_count', 0) for product in products)}</strong> curated archive assets</div>
        <div class="stat"><strong>$1,000</strong> self-funding revenue target</div>
      </div>
    </section>
    <section class="catalog">
      {cards}
    </section>
    <p class="footer">Generated from product artifacts so the catalog stays lightweight and easy to rebuild.</p>
  </main>
</body>
</html>
"""


def main() -> None:
    args = parse_args()
    artifacts_root = Path(args.artifacts_root).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    products = discover_products(artifacts_root)
    manifest_path = output_dir / "catalog.json"
    manifest_path.write_text(json.dumps(products, indent=2))
    (output_dir / "index.html").write_text(build_html(args.title, args.subtitle, products))
    print(json.dumps({"product_count": len(products), "output_dir": str(output_dir)}, indent=2))


if __name__ == "__main__":
    main()
