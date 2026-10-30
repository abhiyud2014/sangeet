# Sangeetayana · 18 October 2026

A self-contained photo and film gallery for **Sangeetayana**, an evening of music held at
Biranarasinghpur, Odisha on 18 October 2026. The site presents all 99 photographs and
9 YouTube films in a responsive, editorial layout — no framework, no build step at runtime.

## Viewing the site

The page works when opened directly (`file://`), but a local server gives you the intended
experience (correct caching, `srcset`, and hash links):

```powershell
cd D:\fromKukan
python -m http.server 5173
```

Then open <http://127.0.0.1:5173/>.

Any static host (GitHub Pages, Netlify, S3) works too — upload the folder as-is.

## What's included

- **Hero** — four-photo crossfade with a slow Ken Burns drift and a staggered title reveal.
- **The evening** — event facts, a layered photo collage, and four clickable chapter cards
  derived from capture time: Golden Hour, Lamplight, Moonrise, Finale.
- **Gallery** — all 99 photos in a justified grid with chapter filters, a "surprise me"
  button, and lazy loading. Touch devices get clean tiles; captions live in the viewer.
- **Lightbox** — keyboard arrows, swipe, slideshow, zoom, download, thumbnail strip, and
  shareable `#photo-N` deep links (hash changes are handled live).
- **Films** — a featured film you can browse with on-screen arrows or the keyboard, plus a
  grid of the other eight. Each opens a modal with a privacy-friendly `youtube-nocookie`
  embed and its real title and artist.
- **Details** — PWA manifest and icons, Open Graph image, shareable hash links that
  work without page reloads, reduced-motion support, and a skip link.

## Rebuilding assets

Originals live in `images/`; video titles and order live in `VIDEOS` in `build.py`
(`videos.txt` mirrors the source links).

```powershell
pip install pillow
python build.py
```

The script:

1. Reads EXIF capture times and sorts the photos chronologically.
2. Writes responsive WebP renditions (480 / 720 / 960 / 1600 px) with inline LQIP
   placeholders to `assets/media/photos/`.
3. Picks four hero frames and writes them to `assets/media/hero/`.
4. Downloads YouTube thumbnails into `assets/media/films/` (needs internet; falls back to
   remote `hqdefault.jpg` if a download fails).
5. Generates `assets/js/data.js` (photo list, chapters, hero frames, film metadata), the
   Open Graph image, favicon, and PWA icons.

> **Note:** generated photo names are index-based (`013-DSC_2088-960.webp`). The night
> collage in `index.html` hard-codes two of them (`013-…` and `050-…`). If you add or
> remove originals, re-run the build and update those two `src`/`srcset` paths.

## Structure

```text
fromKukan/
├─ index.html                  Page markup and metadata
├─ README.md                   This file
├─ manifest.webmanifest        PWA manifest
├─ build.py                    Asset pipeline (EXIF → WebP, data.js, branding)
├─ videos.txt                  Source list of nine YouTube URLs
├─ images/                     99 original photographs (untouched)
└─ assets/
   ├─ css/style.css            Design system, layout, responsive rules
   ├─ js/app.js                Hero, menu, filters, justified grid, lightbox, films
   ├─ js/data.js               Generated photo/chapter/film data
   ├─ fonts/                   Self-hosted variable WOFF2 + manifest
   └─ media/
      ├─ photos/               99 photos × 4 WebP sizes
      ├─ hero/                 Four hero frames
      ├─ films/                Nine local YouTube thumbnails
      ├─ icons/                PWA icons
      ├─ og.jpg                Social preview image
      └─ favicon.svg
```

## Editing content

- **Films** — update `VIDEOS` in `build.py` (YouTube ID, title, artist; the first entry is
  the opening film) and mirror the links in `videos.txt`, then rebuild.
- **Chapters** — adjust `CHAPTERS` in `build.py`. Photos are grouped by capture time, so
  changing the boundaries reassigns frames automatically.
- **Copy** — all headings and prose are in `index.html`; colours, type, and spacing are
  CSS custom properties at the top of `assets/css/style.css`.

## Credits

- Photographs and films: the Sangeetayana 2026 archive, Biranarasinghpur, Odisha.
- Performers featured in the films: Arabinda Mishra; Manjayee & Suman; Swarup & Manas;
  Sudhanshu Mishra; Bratati Mahapatra; Manjayee Rath; Snehali Senapati.
- Typefaces: [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond),
  [Outfit](https://fonts.google.com/specimen/Outfit), and
  [Noto Serif Bengali](https://fonts.google.com/noto/specimen/Noto+Serif+Bengali),
  all under the SIL Open Font License. Fonts are self-hosted in `assets/fonts/`.
- Films are embedded from YouTube; all rights remain with their owners.
