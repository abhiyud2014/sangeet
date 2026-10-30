/* ==========================================================================
   Sangeetayana 2026 — gallery interactions
   Vanilla JS, no dependencies. Data comes from assets/js/data.js
   ========================================================================== */
(() => {
  "use strict";

  const data = window.SANGEET_DATA;
  if (!data) return;

  const photos = data.photos;
  const chapters = data.chapters;
  const films = data.films;
  const total = photos.length;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2, "0");

  const photoSrc = (p, size) => `assets/media/photos/${p.stem}-${size}.webp`;
  const time12 = (t) => {
    const [h, m] = t.split(":").map(Number);
    const suffix = h >= 12 ? "pm" : "am";
    return `${h % 12 || 12}:${pad(m)} ${suffix}`;
  };
  const range12 = (start, end) => `${time12(start)} – ${time12(end)}`;
  const altFor = (p) =>
    `Sangeetayana, 18 October 2026 — photograph ${p.n} of ${total}, taken at ${time12(
      p.t
    )} during ${p.chLabel}`;
  const esc = (str) =>
    String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ------------------------------------------------------------------ *
   * Scroll lock + focus helpers
   * ------------------------------------------------------------------ */
  let lastFocus = null;

  const lockScroll = () => {
    lastFocus = document.activeElement;
    document.body.classList.add("is-locked");
  };
  const unlockScroll = () => {
    document.body.classList.remove("is-locked");
    if (lastFocus && typeof lastFocus.focus === "function") {
      try {
        lastFocus.focus({ preventScroll: true });
      } catch (_) {}
    }
  };
  const trapFocus = (event, container) => {
    const focusable = $$(
      'a[href], button:not([disabled]), input, iframe, [tabindex]:not([tabindex="-1"])',
      container
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  /* ------------------------------------------------------------------ *
   * Header: progress, hide on scroll, active section
   * ------------------------------------------------------------------ */
  const header = $("[data-header]");
  const progress = $(".page-progress span");
  let lastScroll = window.scrollY;
  let ticking = false;

  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;

    if (header) {
      header.classList.toggle("is-scrolled", y > 40);
    }

    if (!reduced) {
      const heroSlides = $(".hero-slides");
      if (heroSlides && y < window.innerHeight) {
        heroSlides.style.transform = `translate3d(0, ${y * 0.14}px, 0)`;
      }
      $$("[data-parallax]").forEach((el) => {
        const rect = el.parentElement.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return;
        const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * parseFloat(el.dataset.parallax);
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });
    }

    lastScroll = y;
    ticking = false;
  };

  const requestScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  };
  window.addEventListener("scroll", requestScroll, { passive: true });
  onScroll();

  /* Active nav link */
  const navLinks = $$(".primary-nav a");
  const sectionIds = ["night", "gallery", "films"];
  if ("IntersectionObserver" in window) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${id}`));
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) navObserver.observe(el);
    });
  }

  /* ------------------------------------------------------------------ *
   * Mobile menu
   * ------------------------------------------------------------------ */
  const menu = $("[data-menu]");
  const menuToggle = $("[data-menu-toggle]");
  const menuLabel = $(".nav-toggle-label");

  const openMenu = () => {
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    header.classList.add("is-menu-open");
    menuToggle.setAttribute("aria-expanded", "true");
    if (menuLabel) menuLabel.textContent = "Close";
    lockScroll();
    setTimeout(() => $(".menu-nav a", menu)?.focus({ preventScroll: true }), 450);
  };
  const closeMenu = (restore = true) => {
    if (!menu.classList.contains("is-open")) return;
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    header.classList.remove("is-menu-open");
    menuToggle.setAttribute("aria-expanded", "false");
    if (menuLabel) menuLabel.textContent = "Menu";
    unlockScroll();
    if (restore) menuToggle.focus({ preventScroll: true });
  };

  menuToggle?.addEventListener("click", () => {
    menu.classList.contains("is-open") ? closeMenu() : openMenu();
  });
  $$("[data-menu-link]").forEach((link) => {
    link.addEventListener("click", () => closeMenu(false));
  });
  menu?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
    if (e.key === "Tab") trapFocus(e, menu);
  });

  /* ------------------------------------------------------------------ *
   * Hero slideshow
   * ------------------------------------------------------------------ */
  const heroSlidesWrap = $("[data-hero-slides]");
  const heroDots = $("[data-hero-dots]");
  const heroCurrent = $("[data-hero-current]");
  const heroTotal = $("[data-hero-total]");
  const heroes = data.heroes || [];
  let heroIndex = 0;
  let heroTimer = null;

  if (heroSlidesWrap && heroes.length) {
    heroSlidesWrap.innerHTML = heroes
      .map(
        (h, i) => `
        <div class="hero-slide${i === 0 ? " is-active" : ""}" data-hero-slide>
          <img src="${h.src}" alt="" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />
        </div>`
      )
      .join("");

    heroDots.innerHTML = heroes
      .map(
        (_, i) =>
          `<button type="button" class="${i === 0 ? "is-active" : ""}" data-hero-dot="${i}" aria-label="Show hero photograph ${i + 1} of ${heroes.length}" aria-current="${i === 0 ? "true" : "false"}"></button>`
      )
      .join("");

    if (heroTotal) heroTotal.textContent = pad(heroes.length);

    const showHero = (next) => {
      heroIndex = (next + heroes.length) % heroes.length;
      $$("[data-hero-slide]").forEach((slide, i) => slide.classList.toggle("is-active", i === heroIndex));
      $$("[data-hero-dot]").forEach((dot, i) => {
        dot.classList.toggle("is-active", i === heroIndex);
        dot.setAttribute("aria-current", i === heroIndex ? "true" : "false");
      });
      if (heroCurrent) heroCurrent.textContent = pad(heroIndex + 1);
    };

    const startHeroTimer = () => {
      if (reduced) return;
      window.clearInterval(heroTimer);
      heroTimer = window.setInterval(() => showHero(heroIndex + 1), 7800);
    };

    $$("[data-hero-dot]").forEach((dot) => {
      dot.addEventListener("click", () => {
        showHero(Number(dot.dataset.heroDot));
        startHeroTimer();
      });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) window.clearInterval(heroTimer);
      else startHeroTimer();
    });
    startHeroTimer();
  }

  const heroTitle = $("[data-split]");
  if (heroTitle) {
    const label = heroTitle.textContent.trim();
    heroTitle.setAttribute("aria-label", label);
    heroTitle.innerHTML = `<span aria-hidden="true">${label
      .split("")
      .map((ch, i) => `<span class="split-char" style="--i:${i}">${ch === " " ? "&nbsp;" : ch}</span>`)
      .join("")}</span>`;
    heroTitle.classList.add("is-split");
  }

  /* ------------------------------------------------------------------ *
   * Section reveal + counters
   * ------------------------------------------------------------------ */
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    $$("[data-reveal]").forEach((el) => revealObserver.observe(el));
  } else {
    $$("[data-reveal]").forEach((el) => el.classList.add("is-in"));
  }

  const counters = $$("[data-count]");
  if (counters.length) {
    const animateCount = (el) => {
      const target = Number(el.dataset.count);
      if (!Number.isFinite(target)) return;
      if (reduced) {
        el.textContent = pad(target);
        return;
      }
      const duration = 1300;
      const started = performance.now();
      const step = (now) => {
        const p = Math.min((now - started) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = pad(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if ("IntersectionObserver" in window) {
      const countObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            animateCount(entry.target);
            countObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.6 }
      );
      counters.forEach((el) => countObserver.observe(el));
    } else {
      counters.forEach(animateCount);
    }
  }

  /* ------------------------------------------------------------------ *
   * Chapters
   * ------------------------------------------------------------------ */
  const chapterWrap = $("[data-chapters]");
  const thumbFor = (chapterId) => photos.find((p) => p.ch === chapterId);

  if (chapterWrap) {
    chapterWrap.innerHTML = chapters
      .map((ch, i) => {
        const thumb = thumbFor(ch.id);
        const bg = thumb ? photoSrc(thumb, 480) : "";
        return `
          <button class="chapter" type="button" data-chapter="${ch.id}" aria-pressed="false">
            <span class="chapter-bg" style="background-image:url('${bg}')" aria-hidden="true"></span>
            <span class="chapter-index">${pad(i + 1)}</span>
            <span class="chapter-label">${esc(ch.label)}</span>
            <span class="chapter-meta"><span>${range12(ch.start, ch.end)}</span><span class="chapter-count">${ch.count} frames</span></span>
          </button>`;
      })
      .join("");

    chapterWrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-chapter]");
      if (!btn) return;
      applyFilter(btn.dataset.chapter);
      document.getElementById("gallery")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    });
  }

  /* ------------------------------------------------------------------ *
   * Gallery
   * ------------------------------------------------------------------ */
  const grid = $("[data-gallery]");
  const filterWrap = $("[data-filters]");
  const filterCount = $("[data-filter-count]");
  const tileMap = new Map();
  let currentFilter = "all";
  let visible = photos;

  const buildTile = (p) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.dataset.n = p.n;
    tile.style.flexGrow = p.w / p.h;
    tile.setAttribute("aria-label", `Open photograph ${p.n} of ${total} — ${time12(p.t)}, ${p.chLabel}`);
    tile.innerHTML = `
      <span class="tile-media" style="background-image:url('${p.lqip}')" aria-hidden="true"></span>
      <img src="${photoSrc(p, 720)}"
           srcset="${photoSrc(p, 480)} 480w, ${photoSrc(p, 720)} 720w, ${photoSrc(p, 960)} 960w"
           sizes="(max-width: 640px) 46vw, (max-width: 1024px) 31vw, 23vw"
           alt="${esc(altFor(p))}" loading="lazy" decoding="async" />
      <span class="tile-meta">
        <span class="tile-clock">${time12(p.t)}</span>
        <span class="tile-chapter">${esc(p.chLabel)}</span>
      </span>
      <span class="tile-expand" aria-hidden="true"><svg class="icon"><use href="#icon-expand" /></svg></span>`;

    const img = tile.querySelector("img");
    const reveal = () => tile.classList.add("is-loaded");
    if (img.complete) reveal();
    img.addEventListener("load", reveal, { once: true });
    tile.addEventListener("click", () => openLightbox(p.n, visible));

    if ("IntersectionObserver" in window) {
      tileObserver.observe(tile);
    } else {
      tile.classList.add("is-in");
    }
    tileMap.set(p.n, tile);
    return tile;
  };

  const tileObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        tileObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.04, rootMargin: "0px 0px 14% 0px" }
  );

  const layoutGallery = () => {
    if (!grid) return;
    const list = visible;
    const width = grid.clientWidth;
    if (!width) return;
    const styles = getComputedStyle(grid);
    const gap = parseFloat(styles.columnGap || styles.getPropertyValue("--tile-gap")) || 14;
    const target = width < 560 ? 185 : width < 900 ? 235 : width < 1280 ? 285 : 330;

    const rows = [];
    let row = [];
    let ratioSum = 0;

    list.forEach((p) => {
      const ratio = p.w / p.h;
      row.push(p);
      ratioSum += ratio;
      const natural = ratioSum * target + gap * (row.length - 1);
      if (natural >= width) {
        rows.push({ items: row, full: true, ratio: ratioSum });
        row = [];
        ratioSum = 0;
      }
    });
    if (row.length) rows.push({ items: row, full: false, ratio: ratioSum });

    const fragment = document.createDocumentFragment();
    rows.forEach((r) => {
      const rowEl = document.createElement("div");
      rowEl.className = "grow-row";
      let height;
      if (r.full) {
        height = (width - gap * (r.items.length - 1)) / r.ratio;
      } else {
        height = target;
        rowEl.style.width = `${Math.min(width, r.ratio * target + gap * (r.items.length - 1))}px`;
      }
      rowEl.style.height = `${height.toFixed(2)}px`;
      r.items.forEach((p) => {
        const tile = tileMap.get(p.n) || buildTile(p);
        rowEl.appendChild(tile);
      });
      fragment.appendChild(rowEl);
    });

    grid.replaceChildren(fragment);
  };

  const scheduleLayout = () => {
    if (!grid) return;
    layoutGallery();
  };

  let resizeFrame = null;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      scheduleLayout();
      if (window.innerWidth > 900) closeMenu(false);
    });
  });

  /* Filters */
  const allChip = `<button class="chip is-active" type="button" data-filter="all" aria-pressed="true">All <b>${total}</b></button>`;
  if (filterWrap) {
    filterWrap.innerHTML =
      allChip +
      chapters
        .map(
          (ch) =>
            `<button class="chip" type="button" data-filter="${ch.id}" aria-pressed="false">${esc(ch.label)} <b>${ch.count}</b></button>`
        )
        .join("");

    filterWrap.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-filter]");
      if (chip) applyFilter(chip.dataset.filter);
    });
  }

  function applyFilter(filter) {
    if (!grid) return;
    currentFilter = filter;
    visible = filter === "all" ? photos : photos.filter((p) => p.ch === filter);
    visible = visible.slice().sort((a, b) => a.n - b.n);

    $$("[data-filter]").forEach((chip) => {
      const on = chip.dataset.filter === filter;
      chip.classList.toggle("is-active", on);
      chip.setAttribute("aria-pressed", on ? "true" : "false");
    });
    $$("[data-chapter]").forEach((btn) => {
      const on = btn.dataset.chapter === filter;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (filterCount) {
      filterCount.textContent = `${visible.length} photograph${visible.length === 1 ? "" : "s"}`;
    }

    grid.classList.add("is-filtering");
    window.setTimeout(() => {
      layoutGallery();
      grid.classList.remove("is-filtering");
    }, reduced ? 0 : 180);
  }

  // Initial build
  if (grid) {
    photos.forEach(buildTile);
    layoutGallery();
    setTimeout(layoutGallery, 120);
  }

  /* Surprise me */
  $("[data-surprise]")?.addEventListener("click", () => {
    if (!visible.length) return;
    const pick = visible[Math.floor(Math.random() * visible.length)];
    openLightbox(pick.n, visible);
  });

  /* ------------------------------------------------------------------ *
   * Lightbox
   * ------------------------------------------------------------------ */
  const lightbox = $("[data-lightbox]");
  const lbImg = $("[data-lb-img]");
  const lbFrame = $("[data-lb-frame]");
  const lbStage = $("[data-lb-stage]");
  const lbCounter = $("[data-lb-counter]");
  const lbTitle = $("[data-lb-title]");
  const lbMeta = $("[data-lb-meta]");
  const lbStrip = $("[data-lb-strip]");
  const lbDownload = $("[data-lb-download]");
  const lbOriginal = $("[data-lb-original]");
  const lbPlay = $("[data-lb-play]");
  const lbPlayIcon = $("[data-lb-play-icon]");
  const lbZoom = $("[data-lb-zoom]");
  const lbPrev = $("[data-lb-prev]");
  const lbNext = $("[data-lb-next]");

  const lbState = {
    list: photos,
    index: 0,
    open: false,
    playing: false,
    timer: null,
    zoom: 1,
    x: 0,
    y: 0,
    drag: null,
    token: 0,
    stripBuilt: false,
  };

  const currentPhoto = () => lbState.list[lbState.index];

  const resetZoom = () => {
    lbState.zoom = 1;
    lbState.x = 0;
    lbState.y = 0;
    lbImg.style.transform = "";
    lbFrame.classList.remove("is-zoomed", "is-dragging");
    lbZoom?.classList.remove("is-active");
    lbZoom?.setAttribute("aria-pressed", "false");
    lbZoom?.setAttribute("aria-label", "Zoom photograph");
  };

  const toggleZoom = () => {
    if (lbState.zoom > 1) {
      resetZoom();
      return;
    }
    lbState.zoom = 2.2;
    lbState.x = 0;
    lbState.y = 0;
    lbImg.style.transform = "scale(2.2)";
    lbFrame.classList.add("is-zoomed");
    lbZoom?.classList.add("is-active");
    lbZoom?.setAttribute("aria-pressed", "true");
    lbZoom?.setAttribute("aria-label", "Reset zoom");
    pauseSlideshow();
  };

  const buildStrip = () => {
    if (!lbStrip) return;
    lbStrip.innerHTML = lbState.list
      .map(
        (p, i) => `
        <button class="lb-thumb" type="button" data-lb-thumb="${i}" aria-label="Go to photograph ${p.n}">
          <img src="${photoSrc(p, 480)}" alt="" loading="lazy" decoding="async" />
        </button>`
      )
      .join("");
    lbState.stripBuilt = true;
  };

  const syncStrip = () => {
    if (!lbStrip) return;
    const thumbs = $$(".lb-thumb", lbStrip);
    thumbs.forEach((t, i) => t.classList.toggle("is-active", i === lbState.index));
    const active = thumbs[lbState.index];
    if (active) active.scrollIntoView({ behavior: reduced ? "auto" : "smooth", inline: "center", block: "nearest" });
  };

  const preloadNeighbours = () => {
    const len = lbState.list.length;
    [lbState.index + 1, lbState.index - 1].forEach((i) => {
      const p = lbState.list[(i + len) % len];
      if (!p) return;
      const im = new Image();
      im.src = photoSrc(p, 960);
    });
  };

  const renderLightboxImage = (p) => {
    lbState.token += 1;
    const token = lbState.token;
    lbImg.classList.remove("is-ready");
    lbImg.alt = altFor(p);
    lbImg.sizes = "min(94vw, 1600px)";
    lbImg.srcset = `${photoSrc(p, 960)} 960w, ${photoSrc(p, 1600)} 1600w`;
    lbImg.src = photoSrc(p, 1600);
    const show = () => {
      if (token === lbState.token) lbImg.classList.add("is-ready");
    };
    if (lbImg.complete && lbImg.naturalWidth) show();
    else lbImg.addEventListener("load", show, { once: true });
    lbImg.addEventListener(
      "error",
      () => {
        if (token === lbState.token) lbImg.classList.add("is-ready");
      },
      { once: true }
    );
  };

  const showPhoto = (index) => {
    if (!lbState.list.length) return;
    const length = lbState.list.length;
    lbState.index = ((index % length) + length) % length;
    const p = currentPhoto();

    resetZoom();
    renderLightboxImage(p);

    if (lbCounter) lbCounter.textContent = `${pad(lbState.index + 1)} / ${pad(length)}`;
    if (lbTitle) lbTitle.textContent = `${p.chLabel} · ${time12(p.t)}`;
    if (lbMeta) lbMeta.textContent = `Photograph ${p.n} of ${total} · ${p.f} · 18 October 2026`;
    if (lbDownload) {
      lbDownload.href = `images/${p.f}`;
      lbDownload.setAttribute("download", p.f);
    }
    if (lbOriginal) lbOriginal.href = `images/${p.f}`;
    if (lbStage) {
      const bgUrl = new URL(photoSrc(p, 480), window.location.href).href;
      lbStage.style.setProperty("--lb-bg", `url("${bgUrl}")`);
    }
    if (lbState.open) {
      try {
        history.replaceState(null, "", `#photo-${p.n}`);
      } catch (_) {}
    }
    if (lbStrip) {
      if (!lbState.stripBuilt || lbStrip.children.length !== length) buildStrip();
      syncStrip();
    }
    preloadNeighbours();
  };

  function openLightbox(n, list) {
    if (!lightbox) return;
    const source = list && list.length ? list : photos;
    lbState.list = source;
    lbState.index = Math.max(0, source.findIndex((p) => p.n === n));
    lbState.stripBuilt = false;
    lbState.open = true;
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    lockScroll();
    showPhoto(lbState.index);
    window.setTimeout(() => $("[data-lb-close]", lightbox)?.focus({ preventScroll: true }), 450);
    try {
      history.replaceState(null, "", `#photo-${n}`);
    } catch (_) {}
  }

  function closeLightbox() {
    if (!lightbox || !lbState.open) return;
    lbState.open = false;
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    pauseSlideshow();
    resetZoom();
    lbStrip.innerHTML = "";
    lbState.stripBuilt = false;
    lbImg.removeAttribute("src");
    lbImg.removeAttribute("srcset");
    unlockScroll();
    try {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch (_) {}
  }

  const step = (delta) => {
    if (!lbState.open) return;
    pauseSlideshow();
    showPhoto(lbState.index + delta);
  };

  const startSlideshow = () => {
    if (lbState.playing) return;
    lbState.playing = true;
    lbPlay?.classList.add("is-active");
    lbPlay?.setAttribute("aria-label", "Pause slideshow");
    if (lbPlayIcon) lbPlayIcon.setAttribute("href", "#icon-pause");
    lbState.timer = window.setInterval(() => {
      showPhoto(lbState.index + 1);
      preloadNeighbours();
    }, 4200);
  };

  function pauseSlideshow() {
    lbState.playing = false;
    window.clearInterval(lbState.timer);
    lbState.timer = null;
    lbPlay?.classList.remove("is-active");
    lbPlay?.setAttribute("aria-label", "Start slideshow");
    if (lbPlayIcon) lbPlayIcon.setAttribute("href", "#icon-play");
  }

  const toggleSlideshow = () => (lbState.playing ? pauseSlideshow() : startSlideshow());

  $("[data-lb-close]")?.addEventListener("click", closeLightbox);
  lbPrev?.addEventListener("click", () => step(-1));
  lbNext?.addEventListener("click", () => step(1));
  lbZoom?.addEventListener("click", toggleZoom);
  lbPlay?.addEventListener("click", toggleSlideshow);

  lbStrip?.addEventListener("click", (e) => {
    const thumb = e.target.closest("[data-lb-thumb]");
    if (!thumb) return;
    pauseSlideshow();
    showPhoto(Number(thumb.dataset.lbThumb));
  });

  lightbox?.addEventListener("mousedown", (e) => {
    if (e.target === lbStage) closeLightbox();
  });

  lbImg?.addEventListener("click", (e) => {
    if (window.matchMedia("(hover: none)").matches) return;
    if (lbState.drag && Math.abs(lbState.drag.dx) > 6 && Math.abs(lbState.drag.dy) > 6) return;
    toggleZoom();
    e.stopPropagation();
  });

  /* Zoom panning */
  lbImg?.addEventListener("pointerdown", (e) => {
    if (lbState.zoom <= 1) return;
    lbState.drag = { startX: e.clientX, startY: e.clientY, ox: lbState.x, oy: lbState.y, dx: 0, dy: 0 };
    lbFrame.classList.add("is-dragging");
    lbImg.setPointerCapture?.(e.pointerId);
  });

  lbImg?.addEventListener("pointermove", (e) => {
    if (!lbState.drag) return;
    const dx = e.clientX - lbState.drag.startX;
    const dy = e.clientY - lbState.drag.startY;
    lbState.drag.dx = dx;
    lbState.drag.dy = dy;
    const maxX = (lbImg.clientWidth * (lbState.zoom - 1)) / 2;
    const maxY = (lbImg.clientHeight * (lbState.zoom - 1)) / 2;
    lbState.x = Math.max(-maxX, Math.min(maxX, lbState.drag.ox + dx));
    lbState.y = Math.max(-maxY, Math.min(maxY, lbState.drag.oy + dy));
    lbImg.style.transform = `translate3d(${lbState.x}px, ${lbState.y}px, 0) scale(${lbState.zoom})`;
  });

  const endDrag = (e) => {
    if (!lbState.drag) return;
    lbFrame.classList.remove("is-dragging");
    lbState.drag = null;
    lbImg.releasePointerCapture?.(e.pointerId);
  };
  lbImg?.addEventListener("pointerup", endDrag);
  lbImg?.addEventListener("pointercancel", endDrag);

  /* Swipe */
  let swipe = null;
  lbStage?.addEventListener("pointerdown", (e) => {
    if (lbState.zoom > 1) return;
    swipe = { x: e.clientX, y: e.clientY, time: Date.now() };
  });
  lbStage?.addEventListener("pointerup", (e) => {
    if (!swipe || lbState.zoom > 1) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    const dt = Date.now() - swipe.time;
    swipe = null;
    if (Math.abs(dx) > 55 && Math.abs(dy) < 70 && dt < 800) {
      step(dx < 0 ? 1 : -1);
    }
  });

  /* Keyboard */
  document.addEventListener("keydown", (e) => {
    if (filmModal.classList.contains("is-open")) {
      if (e.key === "Escape") closeFilm();
      if (e.key === "Tab") trapFocus(e, filmModal);
      return;
    }
    if (!lbState.open) {
      if (menu.classList.contains("is-open")) return;
      return;
    }
    switch (e.key) {
      case "Escape":
        closeLightbox();
        break;
      case "ArrowRight":
        e.preventDefault();
        step(1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        step(-1);
        break;
      case "Home":
        e.preventDefault();
        pauseSlideshow();
        showPhoto(0);
        break;
      case "End":
        e.preventDefault();
        pauseSlideshow();
        showPhoto(lbState.list.length - 1);
        break;
      case " ":
        e.preventDefault();
        toggleSlideshow();
        break;
      case "z":
      case "Z":
        toggleZoom();
        break;
      case "Tab":
        trapFocus(e, lightbox);
        break;
      default:
        break;
    }
  });

  /* ------------------------------------------------------------------ *
   * Films
   * ------------------------------------------------------------------ */
  const filmFeature = $("[data-film-feature]");
  const filmGrid = $("[data-film-grid]");

  if (filmFeature && films.length) {
    let featured = 0;

    function paintFeature() {
      const f = films[featured];
      filmFeature.innerHTML = `
        <div class="feature-stage">
          <button class="feature-media" type="button" data-film="${featured}" aria-label="Play film: ${esc(f.title)}">
            <img src="${f.thumb}" alt="Still from ${esc(f.title)}" loading="lazy" decoding="async" />
            <span class="feature-badge"><b>Film ${pad(featured + 1)}</b> · ${featured === 0 ? "Opening" : "Featured"}</span>
            <span class="feature-play" aria-hidden="true"><svg class="icon"><use href="#icon-play" /></svg></span>
          </button>
          <button class="feature-arrow feature-arrow-prev" type="button" data-feature-prev aria-label="Previous film">
            <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left" /></svg>
          </button>
          <button class="feature-arrow feature-arrow-next" type="button" data-feature-next aria-label="Next film">
            <svg class="icon" aria-hidden="true"><use href="#icon-arrow-right" /></svg>
          </button>
          <span class="feature-count" aria-hidden="true">${pad(featured + 1)} <i>/</i> ${pad(films.length)}</span>
        </div>
        <div class="feature-info" aria-live="polite">
          <p class="eyebrow">${featured === 0 ? "Opening film" : "Featured film"}</p>
          <h3 class="feature-title">${esc(f.title)}</h3>
          <p class="feature-artist">${esc(f.artist)}</p>
          <p class="feature-desc">Recorded live on 18 October 2026 at Biranarasinghpur, and shared on YouTube. Press play to watch the performance here.</p>
          <div class="feature-actions">
            <button class="btn btn-solid" type="button" data-film="${featured}">
              <svg class="icon" aria-hidden="true"><use href="#icon-play" /></svg>
              <span>Play the film</span>
            </button>
            <span class="feature-note">${pad(films.length)} films · YouTube</span>
          </div>
        </div>`;
    }

    function paintFilmGrid() {
      if (!filmGrid) return;
      filmGrid.innerHTML = films
        .map((f, i) => ({ f, i }))
        .filter(({ i }) => i !== featured)
        .map(
          ({ f, i }) => `
          <button class="film-card" type="button" data-film="${i}" aria-label="Play film: ${esc(f.title)}">
            <span class="film-thumb">
              <img src="${f.thumb}" alt="Still from ${esc(f.title)}" loading="lazy" decoding="async" />
              <span class="film-num">${pad(i + 1)}</span>
              <span class="film-play" aria-hidden="true"><svg class="icon"><use href="#icon-play" /></svg></span>
            </span>
            <span class="film-info">
              <span class="film-title">${esc(f.title)}</span>
              <span class="film-artist">${esc(f.artist)}</span>
            </span>
          </button>`
        )
        .join("");
    }

    function stepFeature(dir, keepFocus) {
      featured = (featured + dir + films.length) % films.length;
      paintFeature();
      paintFilmGrid();
      if (keepFocus) {
        const selector = dir > 0 ? "[data-feature-next]" : "[data-feature-prev]";
        filmFeature.querySelector(selector)?.focus({ preventScroll: true });
      }
    }

    paintFeature();
    paintFilmGrid();

    filmFeature.addEventListener("click", (e) => {
      if (e.target.closest("[data-feature-next]")) stepFeature(1, true);
      else if (e.target.closest("[data-feature-prev]")) stepFeature(-1, true);
    });

    filmFeature.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        stepFeature(1, false);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepFeature(-1, false);
      }
    });
  }

  const filmModal = $("[data-film-modal]");
  const fmVideo = $("[data-fm-video]");
  const fmTitle = $("[data-fm-title]");
  const fmArtist = $("[data-fm-artist]");
  const fmLink = $("[data-fm-link]");

  function openFilm(index) {
    const f = films[index];
    if (!f || !filmModal) return;
    lastFocus = document.activeElement;
    fmTitle.textContent = f.title;
    fmArtist.textContent = f.artist;
    fmLink.href = f.url;
    fmVideo.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${f.id}?autoplay=1&rel=0&modestbranding=1" title="${esc(
      f.title
    )}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    filmModal.classList.add("is-open");
    filmModal.setAttribute("aria-hidden", "false");
    lockScroll();
    window.setTimeout(() => $("[data-fm-close]", filmModal)?.focus({ preventScroll: true }), 350);
  }

  function closeFilm() {
    if (!filmModal.classList.contains("is-open")) return;
    filmModal.classList.remove("is-open");
    filmModal.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      fmVideo.innerHTML = "";
    }, 350);
    unlockScroll();
  }

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-film]");
    if (trigger) openFilm(Number(trigger.dataset.film));
  });
  $("[data-fm-close]")?.addEventListener("click", closeFilm);
  filmModal?.addEventListener("mousedown", (e) => {
    if (e.target === filmModal) closeFilm();
  });

  /* ------------------------------------------------------------------ *
   * Deep link
   * ------------------------------------------------------------------ */
  const hashMatch = window.location.hash.match(/^#photo-(\d+)$/);
  if (hashMatch) {
    const n = Number(hashMatch[1]);
    if (photos.some((p) => p.n === n)) {
      window.setTimeout(() => openLightbox(n, photos), 600);
    }
  }

  window.addEventListener("hashchange", () => {
    const match = window.location.hash.match(/^#photo-(\d+)$/);
    if (!match) {
      if (lbState.open) closeLightbox();
      return;
    }
    const n = Number(match[1]);
    if (!photos.some((p) => p.n === n)) return;
    if (lbState.open && currentPhoto()?.n === n) return;
    openLightbox(n, lbState.open ? lbState.list : photos);
  });

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */
  document.body.classList.add("is-ready");

  // Keyboard access for chapters / chips handled natively by buttons.
  // Prevent an accidental space-scroll when a button is focused.
  document.addEventListener("keyup", (e) => {
    if (e.key === " " && e.target instanceof HTMLButtonElement) e.preventDefault();
  });
})();
