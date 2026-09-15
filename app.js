(() => {
  "use strict";

  const scenes = [...document.querySelectorAll("[data-scene]")];
  const dots = [...document.querySelectorAll("[data-go]")];
  const previousButton = document.querySelector("[data-previous]");
  const nextButton = document.querySelector("[data-next]");
  const openingButton = document.querySelector("[data-open]");
  const doorStage = document.querySelector(".door-stage");
  const scrollPrompt = document.querySelector(".scroll-prompt");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const totalScenes = scenes.length;
  let currentScene = 0;
  let introStarted = false;
  let scrollAnimationFrame = null;

  function maxScrollY() {
    return document.documentElement.scrollHeight - window.innerHeight;
  }

  function targetYFor(targetEl, isLast) {
    if (isLast) return maxScrollY();
    return Math.min(targetEl.getBoundingClientRect().top + window.scrollY, maxScrollY());
  }

  function animateScrollTo(targetEl, isLast) {
    if (scrollAnimationFrame) cancelAnimationFrame(scrollAnimationFrame);
    const startY = window.scrollY;
    const delta = targetYFor(targetEl, isLast) - startY;
    if (Math.abs(delta) < 1) return;
    const duration = Math.min(1400, Math.max(500, Math.abs(delta) * 0.45));
    const startTime = performance.now();

    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      // Recompute the live target each frame: dvh (and thus document height) can
      // shift slightly while a scroll is in progress, so a target frozen at the
      // start would drift stale by the time the animation finishes.
      const liveDelta = targetYFor(targetEl, isLast) - startY;
      window.scrollTo({ top: startY + liveDelta * eased, left: 0, behavior: "instant" });
      scrollAnimationFrame = t < 1 ? requestAnimationFrame(step) : null;
    }

    scrollAnimationFrame = requestAnimationFrame(step);
  }

  function updateNavigation() {
    dots.forEach((dot, index) => {
      const active = index === currentScene;
      dot.setAttribute("aria-selected", String(active));
      dot.tabIndex = active ? 0 : -1;
    });
    previousButton.disabled = currentScene === 0;
    nextButton.disabled = !introStarted || currentScene === totalScenes - 1;
    scrollPrompt.hidden = !introStarted || currentScene === totalScenes - 1;
  }

  function scrollToScene(sceneIndex) {
    const nextIndex = Math.max(0, Math.min(totalScenes - 1, Number(sceneIndex)));
    if (!introStarted && nextIndex > 0) return;
    const target = scenes[nextIndex];
    const isLast = nextIndex === totalScenes - 1;
    if (prefersReducedMotion) {
      window.scrollTo({ top: targetYFor(target, isLast), left: 0, behavior: "instant" });
    } else {
      animateScrollTo(target, isLast);
    }
  }

  function startIntro() {
    if (introStarted) return;
    introStarted = true;
    if (openingButton) openingButton.disabled = true;
    if (doorStage) doorStage.classList.add("is-opening");
    document.documentElement.classList.add("is-unlocked");
    updateNavigation();
    window.setTimeout(() => scrollToScene(1), prefersReducedMotion ? 0 : 1650);
  }

  function installNavigation() {
    openingButton?.addEventListener("click", startIntro);
    previousButton.addEventListener("click", () => scrollToScene(currentScene - 1));
    nextButton.addEventListener("click", () => scrollToScene(currentScene + 1));
    dots.forEach((dot) => dot.addEventListener("click", () => scrollToScene(dot.dataset.go)));
  }

  function installSceneObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("in-view");
        });

        let mostVisible = null;
        entries.forEach((entry) => {
          if (!mostVisible || entry.intersectionRatio > mostVisible.intersectionRatio) mostVisible = entry;
        });
        if (mostVisible && mostVisible.intersectionRatio > 0) {
          const index = scenes.indexOf(mostVisible.target);
          if (index !== -1 && index !== currentScene) {
            currentScene = index;
            updateNavigation();
          }
        }
      },
      { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] },
    );
    scenes.forEach((scene) => observer.observe(scene));
  }

  const SCRATCH_GRID = {
    cols: 24,
    rows: 24,
    reveal: {
      haldi:
        "000000000000000100000000000000011111111111100000000001111111111111100000000011111111111111110000000011111111111111111000001111111111111111111100001111111111111111111100001111111111111111111100011111111111111111111110011111111111111111111110111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111011111111111111111111110001111111111111111111100001111111111111111111100001111111111111111111100001111111111111111111100000011111111111111111000000011111111111111110000000011111111111111110000",
      carnival:
        "000000000100010000000000001110001110111000110100001111111110111111111100011111111111111111111100111111111111111111111110111111111111111111111110111111111111111111111110111111111111111111111110111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111110111111111111111111111110111111111111111111111110111111111111111111111110011111111111111111111110011111111111111111111110011111111111111111111110011111111111111111111110001111111110111111111100001111111110111111111100001111111110111111111000000100001100011000100000000000000100010000000000",
      sangeet:
        "000000000000000000000000000000000001100000000000000000000011110000000000000000000111111000000000000000001111111000000000000000001111111100000000000000111111111111000000000001111111111111100000000001111111111111100000000011111111111111100000000111111111111111111000001111111111111111111000001111111111111111111100001111111111111111111100011111111111111111111110111111111111111111111110111111111111111111111110111111111111111111111110111111111111111111111111111111111111111111111111111111111111111111111111011111111111111111111111011111111111111111111100001111111111111111111100",
      ceremony:
        "000000000000000000000000000000000001100000000000000000000001100000000000000000000011110000000000000000000011110000000000000000001111111100000000000000001111111110000000000000011111111110000000000000111111111111000000000001111111111111100000000001111111111111100000000001111111111111110000001111111111111111111100001111111111111111111100001111111111111111111100001111111111111111111100001111111111111111111100011111111111111111111110111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111011111111111111111111110011111111111111111111110",
    },
  };

  function paintScratchCover(ctx, w, h) {
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#f4dc9e");
    gradient.addColorStop(0.5, "#c8963d");
    gradient.addColorStop(1, "#f1d47f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 0.14;
    ctx.fillStyle = "#6b4a1c";
    const dot = Math.max(5, Math.min(w, h) * 0.026);
    for (let y = dot; y < h; y += dot * 2.6) {
      for (let x = dot; x < w; x += dot * 2.6) {
        ctx.beginPath();
        ctx.arc(x, y, dot * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#5c3d16";
    ctx.font = `600 ${Math.max(9, Math.min(w, h) * 0.1)}px "Cormorant Garamond", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✦ scratch to reveal ✦", w / 2, h / 2);
    ctx.restore();
  }

  function installScratchCard(mask) {
    const key = mask.dataset.scratchMask;
    const bits = SCRATCH_GRID.reveal[key];
    const canvas = mask.querySelector("canvas");
    if (!bits || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cols = SCRATCH_GRID.cols;
    const rows = SCRATCH_GRID.rows;
    const insideTotal = bits.split("").filter((bit) => bit === "1").length;
    const revealedCells = new Set();
    let cssWidth = 0;
    let cssHeight = 0;
    let dragging = false;
    let lastX = null;
    let lastY = null;
    let cleared = false;
    let resizeTimer = null;

    function resize() {
      const rect = mask.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      cssWidth = rect.width;
      cssHeight = rect.height;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintScratchCover(ctx, cssWidth, cssHeight);
      mask.classList.add("is-ready");
    }

    function markRevealed(x, y, r) {
      const col0 = Math.max(0, Math.floor(((x - r) / cssWidth) * cols));
      const col1 = Math.min(cols - 1, Math.floor(((x + r) / cssWidth) * cols));
      const row0 = Math.max(0, Math.floor(((y - r) / cssHeight) * rows));
      const row1 = Math.min(rows - 1, Math.floor(((y + r) / cssHeight) * rows));
      for (let row = row0; row <= row1; row++) {
        for (let col = col0; col <= col1; col++) {
          const idx = row * cols + col;
          if (bits[idx] !== "1" || revealedCells.has(idx)) continue;
          const cx = ((col + 0.5) / cols) * cssWidth;
          const cy = ((row + 0.5) / rows) * cssHeight;
          if ((cx - x) ** 2 + (cy - y) ** 2 <= r * r) revealedCells.add(idx);
        }
      }
      if (!cleared && revealedCells.size / insideTotal >= 0.55) {
        cleared = true;
        mask.classList.add("is-cleared");
      }
    }

    function erase(x, y) {
      const r = Math.max(12, Math.min(cssWidth, cssHeight) * 0.15);
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      markRevealed(x, y, r);
    }

    function localPoint(evt) {
      const rect = canvas.getBoundingClientRect();
      return [evt.clientX - rect.left, evt.clientY - rect.top];
    }

    function handleDown(evt) {
      if (cleared) return;
      dragging = true;
      mask.setPointerCapture?.(evt.pointerId);
      const [x, y] = localPoint(evt);
      erase(x, y);
      lastX = x;
      lastY = y;
      evt.preventDefault();
    }

    function handleMove(evt) {
      if (!dragging || cleared) return;
      const [x, y] = localPoint(evt);
      if (lastX !== null) {
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.hypot(dx, dy);
        const step = Math.max(4, Math.min(cssWidth, cssHeight) * 0.05);
        const steps = Math.max(1, Math.floor(dist / step));
        for (let i = 1; i <= steps; i += 1) {
          erase(lastX + (dx * i) / steps, lastY + (dy * i) / steps);
        }
      } else {
        erase(x, y);
      }
      lastX = x;
      lastY = y;
      evt.preventDefault();
    }

    function handleUp() {
      dragging = false;
      lastX = null;
      lastY = null;
    }

    mask.addEventListener("pointerdown", handleDown);
    mask.addEventListener("pointermove", handleMove);
    mask.addEventListener("pointerup", handleUp);
    mask.addEventListener("pointercancel", handleUp);
    mask.addEventListener("pointerleave", handleUp);

    window.addEventListener("resize", () => {
      if (cleared) return;
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 200);
    });

    resize();
  }

  function installScratchCards() {
    document.querySelectorAll("[data-scratch-mask]").forEach(installScratchCard);
  }

  updateNavigation();
  installNavigation();
  installSceneObserver();
  installScratchCards();
})();
