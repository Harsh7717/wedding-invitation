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

  function installScratchCards() {
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach(({ target }) => {
        const controller = target.__scratchController;
        if (controller && !controller.revealed) controller.paintCover();
      });
    });

    document.querySelectorAll("[data-scratch]").forEach((wrapper) => {
      const canvas = wrapper.querySelector("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      let drawing = false;
      let revealed = false;
      let lastPoint = null;

      function dimensions() {
        const rect = canvas.getBoundingClientRect();
        return { rect, dpr: Math.max(1, window.devicePixelRatio || 1) };
      }

      function paintCover() {
        if (revealed) return;
        const { rect, dpr } = dimensions();
        if (!rect.width || !rect.height) return;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.globalCompositeOperation = "source-over";
        const parchment = context.createLinearGradient(0, 0, rect.width, rect.height);
        parchment.addColorStop(0, "#a97630");
        parchment.addColorStop(0.2, "#d9b46d");
        parchment.addColorStop(0.52, "#f7e4ad");
        parchment.addColorStop(0.78, "#c48c37");
        parchment.addColorStop(1, "#8d5b25");
        context.fillStyle = parchment;
        context.fillRect(0, 0, rect.width, rect.height);
        const inset = Math.max(1.5, Math.min(4, rect.height * 0.11));
        context.globalAlpha = 0.48;
        context.strokeStyle = "#fff4ce";
        context.lineWidth = 0.9;
        context.strokeRect(inset, inset, rect.width - inset * 2, rect.height - inset * 2);
        context.globalAlpha = 0.62;
        context.strokeStyle = "#765023";
        context.lineWidth = 0.65;
        context.strokeRect(inset + 2.4, inset + 2.4, rect.width - (inset + 2.4) * 2, rect.height - (inset + 2.4) * 2);
        context.globalAlpha = 0.92;
        context.shadowColor = "rgb(80 47 15 / 0.38)";
        context.shadowBlur = Math.max(1, rect.height * 0.05);
        context.fillStyle = "#fff5d3";
        context.font = `600 italic ${Math.max(10, Math.min(16, rect.height * 0.27))}px Georgia`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("✦  scratch to reveal  ✦", rect.width / 2, rect.height / 2);
        context.shadowColor = "transparent";
        context.shadowBlur = 0;
        context.globalAlpha = 1;
      }

      function reveal() {
        if (revealed) return;
        revealed = true;
        wrapper.classList.add("is-revealed");
        canvas.setAttribute("aria-hidden", "true");
        canvas.tabIndex = -1;
      }

      function pointFromEvent(event) {
        const { rect } = dimensions();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
      }

      function scratchSegment(from, to) {
        const { rect } = dimensions();
        context.globalCompositeOperation = "destination-out";
        context.lineCap = "round";
        context.lineJoin = "round";
        context.lineWidth = Math.max(24, Math.min(rect.width, rect.height) * 0.3);
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
      }

      function revealIfEnough() {
        const { rect, dpr } = dimensions();
        if (!rect.width || !rect.height) return;
        const image = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const step = Math.max(8, Math.floor(14 * dpr));
        let cleared = 0;
        let sampled = 0;
        for (let y = step / 2; y < canvas.height; y += step) {
          for (let x = step / 2; x < canvas.width; x += step) {
            sampled += 1;
            if (image[(Math.floor(y) * canvas.width + Math.floor(x)) * 4 + 3] < 32) cleared += 1;
          }
        }
        if (sampled && cleared / sampled >= 0.42) reveal();
      }

      canvas.addEventListener("pointerdown", (event) => {
        if (revealed) return;
        event.preventDefault();
        drawing = true;
        lastPoint = pointFromEvent(event);
        canvas.setPointerCapture(event.pointerId);
        scratchSegment(lastPoint, lastPoint);
      });

      canvas.addEventListener("pointermove", (event) => {
        if (!drawing || revealed) return;
        event.preventDefault();
        const point = pointFromEvent(event);
        scratchSegment(lastPoint, point);
        lastPoint = point;
      });

      const finishDrawing = (event) => {
        if (!drawing) return;
        drawing = false;
        try {
          if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        } catch {
          // The browser may already have released pointer capture.
        }
        revealIfEnough();
      };

      canvas.addEventListener("pointerup", finishDrawing);
      canvas.addEventListener("pointercancel", finishDrawing);
      canvas.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          reveal();
        }
      });
      const controller = {
        paintCover,
        get revealed() {
          return revealed;
        },
      };
      wrapper.__scratchController = controller;
      canvas.__scratchController = controller;
      paintCover();
      resizeObserver.observe(canvas);
    });
  }

  updateNavigation();
  installScratchCards();
  installNavigation();
  installSceneObserver();
})();
