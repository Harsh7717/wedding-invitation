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

  updateNavigation();
  installNavigation();
  installSceneObserver();
})();
