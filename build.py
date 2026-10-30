#!/usr/bin/env python3
"""
Build the web assets for the Sangeetayana 2026 gallery.

Reads originals from ./images and video links from ./videos.txt,
writes responsive WebP renditions + a generated data file into
./assets/media and ./assets/js/data.js.

Re-run after adding or removing photos:
    python build.py
"""

from __future__ import annotations

import base64
import glob
import io
import json
import os
import re
import subprocess
import sys
import urllib.request
from multiprocessing import Pool
from datetime import datetime

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(ROOT, "images")
MEDIA = os.path.join(ROOT, "assets", "media")
PHOTO_DIR = os.path.join(MEDIA, "photos")
FILM_DIR = os.path.join(MEDIA, "films")
HERO_DIR = os.path.join(MEDIA, "hero")
ICON_DIR = os.path.join(MEDIA, "icons")
DATA_DIR = os.path.join(ROOT, "assets", "js")

SIZES = (480, 720, 960, 1600)
QUALITY = {480: 73, 720: 76, 960: 78, 1600: 80}
LQIP_WIDTH = 28

CHAPTERS = [
    ("golden", "Golden Hour", "17:30", "18:00"),
    ("lamplight", "Lamplight", "18:00", "19:00"),
    ("moonrise", "Moonrise", "19:00", "20:00"),
    ("finale", "Finale", "20:00", "21:00"),
]

VIDEOS = [
    ("dvY_fCrRmcA", "Shri Mahishasura Mardini Stotram", "Manjayee & Suman"),
    ("sRRAAUSwniI", "Jibaku Mana Helani", "Arabinda Mishra"),
    ("kiBXLF8K4YI", "Singhabahini Shakti Pradayini Maa", "Swarup & Manas"),
    ("TzAU9lPJtSg", "Bhajare Hruda Mandire", "Sudhanshu Mishra"),
    ("By-eYbKjK_M", "Patitapabana Bana Aau Ketebele Ku", "Sudhanshu Mishra"),
    ("Fh0_drzoicY", "Bhagwad Geeta Paath (Panchadashadhyaya)", "Bratati Mahapatra"),
    ("JDc5mzqF5bc", "Jaya Jaya Jagannath", "Manjayee Rath"),
    ("3jDi_N2Fhx8", "Akhire Thau Bahuda Ratha", "Manjayee Rath"),
    ("d1q0fTDZOCg", "Bhajamana Dinajana Dukhaharinku", "Snehali Senapati"),
    ("XMmoE1NSLvA", "Dinabandhu Daitari Dukha", "Snehali Senapati"),
]

# Photos used for the hero slideshow (file stems)
HERO_FILES = ["DSC_2170", "DSC_2118", "DSC_2153", "DSC_2088"]


def ensure_dirs() -> None:
    for d in (PHOTO_DIR, FILM_DIR, HERO_DIR, ICON_DIR, DATA_DIR):
        os.makedirs(d, exist_ok=True)
    for d in (PHOTO_DIR, HERO_DIR):
        for name in os.listdir(d):
            if name.endswith((".webp", ".jpg")):
                os.remove(os.path.join(d, name))


def chapter_for_time(t: datetime) -> tuple[str, str]:
    minutes = t.hour * 60 + t.minute
    for key, label, start, end in CHAPTERS:
        sh, sm = map(int, start.split(":"))
        eh, em = map(int, end.split(":"))
        if sh * 60 + sm <= minutes < eh * 60 + em:
            return key, label
    return CHAPTERS[-1][0], CHAPTERS[-1][1]


def read_exif_time(path: str) -> datetime:
    with Image.open(path) as im:
        exif = im.getexif()
        raw = exif.get(36867) or exif.get(306)
    if raw:
        try:
            return datetime.strptime(str(raw).strip(), "%Y:%m:%d %H:%M:%S")
        except ValueError:
            pass
    return datetime.fromtimestamp(os.path.getmtime(path))


def lqip_data_uri(im: Image.Image) -> str:
    small = im.copy()
    h = max(1, round(LQIP_WIDTH / small.width * small.height))
    small = small.resize((LQIP_WIDTH, h), Image.LANCZOS)
    buf = io.BytesIO()
    small.save(buf, "WEBP", quality=55, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def render_photo(job: tuple[int, str, str]) -> dict:
    n, path, stem = job
    with Image.open(path) as raw:
        im = ImageOps.exif_transpose(raw).convert("RGB")
        w, h = im.size
        for size in SIZES:
            out = im.copy()
            out.thumbnail((size, size), Image.LANCZOS)
            out.save(
                os.path.join(PHOTO_DIR, f"{stem}-{size}.webp"),
                "WEBP",
                quality=QUALITY[size],
                method=6,
            )
        lqip = lqip_data_uri(im)
    dt = read_exif_time(path)
    ch, label = chapter_for_time(dt)
    return {
        "n": n,
        "f": os.path.basename(path),
        "stem": stem,
        "w": w,
        "h": h,
        "t": dt.strftime("%H:%M"),
        "ch": ch,
        "chLabel": label,
        "lqip": lqip,
    }


def build_photos() -> list[dict]:
    found = glob.glob(os.path.join(SRC_DIR, "*.JPG")) + glob.glob(os.path.join(SRC_DIR, "*.jpg"))
    # Windows globs are case-insensitive; keep one entry per real file.
    files = sorted({os.path.normcase(p): p for p in found}.values())
    jobs = []
    for i, path in enumerate(files, start=1):
        stem = f"{i:03d}-{re.sub(r'[^A-Za-z0-9_-]', '', os.path.splitext(os.path.basename(path))[0])}"
        jobs.append((i, path, stem))

    print(f"  rendering {len(jobs)} photographs ...")
    with Pool(processes=min(10, os.cpu_count() or 4)) as pool:
        photos = []
        for idx, item in enumerate(pool.imap_unordered(render_photo, jobs), start=1):
            photos.append(item)
            if idx % 10 == 0 or idx == len(jobs):
                print(f"    {idx}/{len(jobs)}")
    photos.sort(key=lambda p: p["n"])
    return photos


def build_hero(photos: list[dict]) -> list[dict]:
    by_stem = {p["f"].split(".")[0]: p for p in photos}
    heroes = []
    for i, stem in enumerate(HERO_FILES, start=1):
        path = os.path.join(SRC_DIR, stem + ".JPG")
        if not os.path.exists(path):
            continue
        with Image.open(path) as raw:
            im = ImageOps.exif_transpose(raw).convert("RGB")
            im.thumbnail((1920, 1920), Image.LANCZOS)
            name = f"hero-{i:02d}.webp"
            im.save(os.path.join(HERO_DIR, name), "WEBP", quality=78, method=6)
        photo = by_stem.get(stem)
        heroes.append({"src": f"assets/media/hero/{name}", "photo": photo["n"] if photo else None})
    return heroes


def build_films() -> list[dict]:
    films = []
    for i, (vid, title, artist) in enumerate(VIDEOS, start=1):
        thumb_url = f"https://i.ytimg.com/vi/{vid}/maxresdefault.jpg"
        local = f"film-{i:02d}.jpg"
        dest = os.path.join(FILM_DIR, local)
        try:
            req = urllib.request.Request(thumb_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as res:
                data = res.read()
            with Image.open(io.BytesIO(data)) as im:
                im = im.convert("RGB")
                im.save(dest, "JPEG", quality=86, optimize=True, progressive=True)
            print(f"  film thumb {i}: {title}")
        except Exception as exc:  # noqa: BLE001
            print(f"  ! film thumb {i} failed ({exc})")
            local = None
        films.append(
            {
                "id": vid,
                "title": title,
                "artist": artist,
                "thumb": f"assets/media/films/{local}" if local else f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                "url": f"https://youtu.be/{vid}",
            }
        )
    return films


def build_branding(heroes: list[dict]) -> None:
    # Open Graph image
    og_source = os.path.join(SRC_DIR, "DSC_2118.JPG")
    if os.path.exists(og_source):
        with Image.open(og_source) as raw:
            im = ImageOps.exif_transpose(raw).convert("RGB")
            im = ImageOps.fit(im, (1200, 630), Image.LANCZOS, centering=(0.5, 0.42))
            im.save(os.path.join(MEDIA, "og.jpg"), "JPEG", quality=84, optimize=True, progressive=True)

    # Diya mark icons
    def draw_mark(size: int, path: str) -> None:
        s = size * 4
        img = Image.new("RGB", (s, s), (12, 10, 9))
        d = ImageDraw.Draw(img)
        cx = s / 2
        gold = (232, 180, 101)
        gold_soft = (196, 141, 74)
        # flame
        flame = [
            (cx, s * 0.20),
            (cx + s * 0.11, s * 0.36),
            (cx + s * 0.14, s * 0.47),
            (cx + s * 0.06, s * 0.56),
            (cx, s * 0.57),
        ]
        d.polygon([(x, y) for x, y in flame], fill=gold)
        d.ellipse([cx - s * 0.075, s * 0.40, cx + s * 0.075, s * 0.56], fill=(255, 232, 180))
        # bowl
        d.arc([cx - s * 0.30, s * 0.53, cx + s * 0.30, s * 0.79], start=0, end=180, fill=gold, width=int(s * 0.045))
        d.line([cx - s * 0.30, s * 0.66, cx - s * 0.36, s * 0.63], fill=gold_soft, width=int(s * 0.03))
        d.line([cx + s * 0.30, s * 0.66, cx + s * 0.36, s * 0.63], fill=gold_soft, width=int(s * 0.03))
        # base line
        d.line([cx - s * 0.14, s * 0.80, cx + s * 0.14, s * 0.80], fill=gold_soft, width=int(s * 0.025))
        img.resize((size, size), Image.LANCZOS).save(path, "PNG")

    draw_mark(180, os.path.join(ICON_DIR, "apple-touch-icon.png"))
    draw_mark(192, os.path.join(ICON_DIR, "icon-192.png"))
    draw_mark(512, os.path.join(ICON_DIR, "icon-512.png"))


def build_data(photos: list[dict], heroes: list[dict], films: list[dict]) -> None:
    chapters = []
    for key, label, start, end in CHAPTERS:
        count = sum(1 for p in photos if p["ch"] == key)
        if count:
            chapters.append({"id": key, "label": label, "start": start, "end": end, "count": count})

    payload = {
        "event": {
            "name": "Sangeetayana",
            "native": "ସଙ୍ଗୀତାୟନ",
            "date": "2026-10-18",
            "dateLabel": "18 October 2026",
            "occasion": "Maha Astami · Durga Puja",
            "place": "Biranarasinghpur, Puri, Odisha",
            "start": photos[0]["t"] if photos else "",
            "end": photos[-1]["t"] if photos else "",
        },
        "chapters": chapters,
        "photos": photos,
        "heroes": heroes,
        "films": films,
    }
    js = "// Generated by build.py — do not edit by hand.\nwindow.SANGEET_DATA = " + json.dumps(
        payload, separators=(",", ":"), ensure_ascii=False
    ) + ";\n"
    with open(os.path.join(DATA_DIR, "data.js"), "w", encoding="utf-8") as fh:
        fh.write(js)


def main() -> None:
    ensure_dirs()
    print("Building Sangeetayana gallery assets")
    photos = build_photos()
    heroes = build_hero(photos)
    films = build_films()
    build_branding(heroes)
    build_data(photos, heroes, films)
    total = sum(
        os.path.getsize(os.path.join(PHOTO_DIR, f))
        for f in os.listdir(PHOTO_DIR)
        if f.endswith(".webp")
    )
    print(f"Done: {len(photos)} photos, {len(heroes)} hero frames, {len(films)} films, "
          f"{total / 1024 / 1024:.1f} MB of renditions")


if __name__ == "__main__":
    sys.exit(main())
