/* Harsh & Aayushi · wedding invitation
   1. the peacock doors, 2. one-scene-per-swipe navigation, 3. the scratch-to-reveal plaques.
   Without JS (or if this file never arrives) the doors stay open, the plaques show their text and the
   page scrolls normally; see styles.css and the inline fallback in index.html. */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  if (!root.classList.contains("js")) return;   // the inline fallback already switched to the no-JS page

  var story = doc.getElementById("story");
  var scenes = [].slice.call(doc.querySelectorAll(".scene"));
  var railBtns = [].slice.call(doc.querySelectorAll(".rail button"));
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ?debug=1 outlines every line and fades the foils, ?debug=2 removes the foils, ?debug=3 does both
  var debug = /[?&]debug=(\d)/.exec(location.search);
  var level = debug ? +debug[1] : 0;
  if (level & 1) root.classList.add("debug");
  if (level & 2) root.classList.add("debug-text");

  // the foil hint is drawn in the ornate font, so wait for it (but never for long)
  var fontReady = new Promise(function (resolve) {
    setTimeout(resolve, 2500);
    if (doc.fonts && doc.fonts.load) doc.fonts.load('700 20px "HA Ornate"').then(resolve, resolve);
    else resolve();
  });

  var current = -1;
  var opened = false;

  function go(i) {
    i = Math.max(0, Math.min(scenes.length - 1, i));
    warm(i);    // a jump from the rail: fetch the destination first, not after the scenes passed on the way
    scenes[i].scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  /* ---------- scratch-to-reveal foils ---------- */

  var foils = [];         // by scene index
  var GRID = 48;          // progress is sampled on a grid 48 cells wide
  var CLEAR_AT = 0.55;    // share of the card that must be scratched away

  function Foil(el) {
    var self = this;
    this.el = el;
    this.scene = el.closest(".scene");
    this.canvas = el.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.state = "loading";
    this.touched = false;
    this.moves = 0;

    this.revealBtn = this.scene.querySelector(".reveal");

    this.img = new Image();
    this.img.onload = function () {
      fontReady.then(function () {
        if (self.state !== "loading") return;    // already revealed with the button
        self.paint();
        self.mask = self.alphaGrid(self.img);
        self.state = "ready";
        el.classList.add("is-ready");
        self.scene.classList.add("foil-ready");
        self.bind();
      });
    };
    this.img.onerror = function () { self.finish(false); };   // no foil: just show the details
    this.img.src = el.dataset.src;
  }

  Foil.prototype.size = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    return {
      w: Math.max(2, Math.round(this.el.offsetWidth * dpr)),
      h: Math.max(2, Math.round(this.el.offsetHeight * dpr))
    };
  };

  // the cover art, engraved with "scratch to reveal" between two small diamonds
  Foil.prototype.paint = function () {
    var c = this.canvas;
    var ctx = this.ctx;
    var s = this.size();
    var txt = "scratch to reveal";
    var light = this.el.dataset.ink === "light";
    var y = s.h * parseFloat(this.el.dataset.hint);
    c.width = s.w;
    c.height = s.h;
    ctx.drawImage(this.img, 0, 0, s.w, s.h);

    ctx.save();
    ctx.globalCompositeOperation = "source-atop";       // stay inside the plaque shape
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '700 100px "HA Ornate", Georgia, serif';
    var unit = ctx.measureText(txt).width / 100;        // text width per px of font size
    var fs = Math.min(s.h * 0.15, (s.w * 0.7) / (unit + 1.8));
    ctx.font = "700 " + fs.toFixed(1) + 'px "HA Ornate", Georgia, serif';
    // a soft halo first, so the words stay readable on busy patterns
    ctx.lineJoin = "round";
    ctx.lineWidth = fs * 0.32;
    ctx.strokeStyle = light ? "rgba(48,8,14,.38)" : "rgba(255,244,214,.55)";
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = fs * 0.35;
    ctx.strokeText(txt, s.w / 2, y);
    ctx.fillStyle = light ? "rgba(255,248,230,.86)" : "rgba(66,34,10,.74)";
    ctx.shadowColor = light ? "rgba(40,6,10,.55)" : "rgba(255,246,220,.7)";
    ctx.shadowOffsetY = Math.max(1, fs * 0.06);
    ctx.shadowBlur = fs * 0.08;
    ctx.fillText(txt, s.w / 2, y);
    var half = (unit * fs) / 2;
    var d = fs * 0.22;
    [-1, 1].forEach(function (side) {
      var cx = s.w / 2 + side * (half + fs * 0.62);
      ctx.beginPath();
      ctx.moveTo(cx, y - d);
      ctx.lineTo(cx + d * 0.75, y);
      ctx.lineTo(cx, y + d);
      ctx.lineTo(cx - d * 0.75, y);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  };

  // follow size changes until the guest starts scratching (after that CSS scales the canvas)
  Foil.prototype.resize = function () {
    if (this.state !== "ready" || this.touched) return;
    if (Math.abs(this.size().w - this.canvas.width) > 8) this.paint();
  };

  Foil.prototype.alphaGrid = function (src) {
    var gw = GRID;
    // fixed on first use, so every later sample lines up cell for cell with the starting mask
    var gh = this.gh || (this.gh = Math.max(8, Math.round(gw * this.el.offsetHeight / Math.max(1, this.el.offsetWidth))));
    var t = this.grid || (this.grid = doc.createElement("canvas"));
    t.width = gw;
    t.height = gh;
    var g = this.gctx || (this.gctx = t.getContext("2d", { willReadFrequently: true }));
    g.clearRect(0, 0, gw, gh);
    g.drawImage(src, 0, 0, gw, gh);
    var px = g.getImageData(0, 0, gw, gh).data;
    var a = new Uint8Array(gw * gh);
    for (var i = 0; i < a.length; i++) a[i] = px[i * 4 + 3];
    return a;
  };

  // share of the originally opaque cells that are now mostly clear
  Foil.prototype.progress = function () {
    var now = this.alphaGrid(this.canvas);
    var total = 0;
    var clear = 0;
    for (var i = 0; i < now.length && i < this.mask.length; i++) {
      if (this.mask[i] < 128) continue;
      total++;
      if (now[i] < 110) clear++;
    }
    return total ? clear / total : 1;
  };

  Foil.prototype.bind = function () {
    var self = this;
    var c = this.canvas;
    var drawing = false;
    var pid = null;         // the finger doing the scratching
    var last = null;
    var pending = false;
    var r = 0;

    function at(e) {
      var b = c.getBoundingClientRect();
      return { x: (e.clientX - b.left) / b.width * c.width, y: (e.clientY - b.top) / b.height * c.height };
    }

    function stroke(a, b) {
      var ctx = self.ctx;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = r * 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x + 0.01, b.y);
      ctx.stroke();
      ctx.restore();
    }

    function check() {
      if (pending || self.state !== "ready") return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        if (self.state === "ready" && self.progress() >= CLEAR_AT) self.finish(true);
      });
    }

    function down(e) {
      if (self.state !== "ready" || (e.button != null && e.button > 0)) return;
      // a second finger is ignored while the first is still down (it holds the pointer capture);
      // without that check a lost pointerup could leave the card refusing every later touch
      if (drawing && e.pointerId !== pid && c.hasPointerCapture && c.hasPointerCapture(pid)) return;
      drawing = true;
      pid = e.pointerId;
      if (!self.touched) {
        self.touched = true;
        self.el.classList.add("is-touched");
      }
      // a fingertip-sized brush: 9% of the painting's width, in canvas pixels
      var card = c.getBoundingClientRect();
      var frame = self.el.parentNode.getBoundingClientRect();
      r = frame.width * 0.045 * (c.width / Math.max(1, card.width));
      last = at(e);
      stroke(last, last);
      if (e.pointerId != null && c.setPointerCapture) {
        try { c.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
      }
      if (e.preventDefault) e.preventDefault();
    }

    function move(e) {
      if (!drawing || e.pointerId !== pid) return;
      var list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (!list.length) list = [e];
      for (var i = 0; i < list.length; i++) {
        var p = at(list[i]);
        stroke(last, p);
        last = p;
      }
      if (++self.moves % 5 === 0) check();
      if (e.preventDefault) e.preventDefault();
    }

    function up(e) {
      if (!drawing || (e && e.pointerId !== pid)) return;
      drawing = false;
      check();
    }

    if (window.PointerEvent) {
      c.addEventListener("pointerdown", down);
      c.addEventListener("pointermove", move);
      c.addEventListener("pointerup", up);
      c.addEventListener("pointercancel", up);
      // touch-action: none already keeps the page still; this backs it up on older iOS
      c.addEventListener("touchmove", function (e) {
        if (self.state === "ready" && e.cancelable) e.preventDefault();
      }, { passive: false });
    } else {
      c.addEventListener("mousedown", down);
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      c.addEventListener("touchstart", function (e) { e.preventDefault(); down(e.touches[0]); }, { passive: false });
      c.addEventListener("touchmove", function (e) { e.preventDefault(); move(e.touches[0]); }, { passive: false });
      c.addEventListener("touchend", up);
    }
  };

  Foil.prototype.finish = function (celebrate) {
    if (this.state === "done") return;
    this.state = "done";
    var el = this.el;
    el.classList.add("is-cleared");
    this.scene.classList.add("foil-done");
    if (this.revealBtn) {
      if (doc.activeElement === this.revealBtn) this.scene.focus({ preventScroll: true });
      this.revealBtn.hidden = true;
    }
    if (celebrate && !reduce) petals(el);
    setTimeout(function () { el.hidden = true; }, 1000);
  };

  // a small burst of rose and marigold petals from the cleared card
  function petals(foil) {
    if (!foil.animate) return;
    var colors = ["#f7b9c6", "#f2a24f", "#e5728b", "#ffd27a", "#d84e6b", "#fff1d6"];
    var stage = foil.parentNode;
    var fw = stage.offsetWidth;
    var left = parseFloat(foil.style.left);
    var width = parseFloat(foil.style.width);
    var cy = parseFloat(foil.style.top) + parseFloat(foil.style.height) * 0.55;
    for (var i = 0; i < 18; i++) {
      var p = doc.createElement("i");
      p.className = "petal";
      p.style.left = left + width * (0.15 + Math.random() * 0.7) + "%";
      p.style.top = cy + "%";
      p.style.background = colors[i % colors.length];
      stage.appendChild(p);
      var ang = Math.random() * Math.PI * 2;
      var dist = (0.06 + Math.random() * 0.14) * fw;
      var dx = Math.cos(ang) * dist;
      var dy = Math.sin(ang) * dist * 0.5 + fw * (0.14 + Math.random() * 0.16);
      var spin = Math.random() * 600 - 300;
      var anim = p.animate([
        { transform: "translate(0,0) rotate(0deg) scale(.5)", opacity: 0 },
        { transform: "translate(" + (dx * 0.4).toFixed(1) + "px," + (-fw * 0.05).toFixed(1) + "px) rotate(" + (spin * 0.3).toFixed(0) + "deg) scale(1)", opacity: 1, offset: 0.22 },
        { transform: "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) rotate(" + spin.toFixed(0) + "deg) scale(.85)", opacity: 0 }
      ], {
        duration: 1400 + Math.random() * 700,
        delay: Math.random() * 140,
        easing: "cubic-bezier(.25,.6,.35,1)",
        fill: "both"
      });
      anim.onfinish = (function (node) { return function () { node.remove(); }; })(p);
    }
  }

  /* ---------- scene activation, rail, pre-warming the next scene ---------- */

  function warm(i) {
    var s = scenes[i];
    if (!s || s.dataset.warm) return;
    s.dataset.warm = "1";
    // lazy images in a scroll container only start once visible, so start them a scene early
    [].forEach.call(s.querySelectorAll('img[loading="lazy"]'), function (img) { img.loading = "eager"; });
    var el = s.querySelector(".foil");
    if (el) foils[i] = new Foil(el);
  }

  var warmTimer;
  function activate(i) {
    if (i === current || i < 0) return;
    current = i;
    scenes.forEach(function (s, n) { s.classList.toggle("is-active", n === i); });
    railBtns.forEach(function (b, n) {
      if (n === i) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
    // fetch this scene and the next once the story rests here, not for every scene a long jump flies past
    clearTimeout(warmTimer);
    warmTimer = setTimeout(function () {
      warm(i);
      if (opened) warm(i + 1);
    }, 300);
    if (i !== 1) root.classList.remove("show-hint");
  }

  // The active scene is the one filling most of the screen, read from the scroll position once per
  // frame while scrolling. (An IntersectionObserver also reports the scenes just touching the screen
  // edges as intersecting, and only fires on threshold crossings, which lit up the wrong scene.)
  var queued = false;
  function settle() {
    queued = false;
    var h = story.clientHeight || 1;
    var i = Math.max(0, Math.min(scenes.length - 1, Math.round(story.scrollTop / h)));
    // behind closed doors the story only moves when something else scrolls it (a link to #venue,
    // find-in-page, a screen reader): open them, so the guest is not left on a locked page
    if (i > 0 && !opened) openDoors();
    activate(i);
  }
  story.addEventListener("scroll", function () {
    if (!queued) {
      queued = true;
      requestAnimationFrame(settle);
    }
  }, { passive: true });

  /* ---------- the peacock doors ---------- */

  var doorScene = doc.querySelector(".s-doors");
  var doorBtn = doorScene && doorScene.querySelector(".door-btn");

  function openDoors() {
    if (opened) return;
    opened = true;
    var keyboard = doc.activeElement === doorBtn;
    doorScene.classList.add("is-opening");
    root.classList.add("is-open");            // unlocks scrolling and starts the swing
    warm(1);
    setTimeout(function () {
      doorScene.classList.add("is-opened");    // drop the door layers
      if (current <= 0) go(1);                 // unless the guest already moved on
      if (keyboard) scenes[Math.max(1, current)].focus({ preventScroll: true });
    }, reduce ? 700 : 2600);
    setTimeout(function () {
      if (current === 1) root.classList.add("show-hint");
    }, reduce ? 1600 : 4600);
  }

  if (!doorScene) {
    opened = true;
    root.classList.add("is-open");
  } else {
    doorBtn.addEventListener("click", openDoors);
    // a swipe or a scroll on the closed doors opens them too
    var startY = null;
    story.addEventListener("touchstart", function (e) { startY = e.touches[0].clientY; }, { passive: true });
    story.addEventListener("touchmove", function (e) {
      if (!opened && startY !== null && startY - e.touches[0].clientY > 36) openDoors();
    }, { passive: true });
    story.addEventListener("wheel", function (e) {
      if (!opened && e.deltaY > 4) openDoors();
    }, { passive: true });
    // so does tabbing (or a screen reader) moving past them, which scrolls the story behind them
    doc.addEventListener("focusin", function (e) {
      var t = e.target;
      if (!opened && t && t.nodeType === 1 && t !== doc.body && !doorScene.contains(t)) openDoors();
    });
    // fetch the invitation once the first view has finished loading
    window.addEventListener("load", function () { setTimeout(function () { warm(1); }, 400); });
  }

  /* ---------- rail and keyboard ---------- */

  railBtns.forEach(function (b, i) {
    b.addEventListener("click", function () { go(i); });
  });

  // the keyboard / screen-reader way past a foil; it works even before the scene has been visited
  scenes.forEach(function (s, i) {
    var btn = s.querySelector(".reveal");
    if (btn) btn.addEventListener("click", function () {
      warm(i);
      if (foils[i]) foils[i].finish(false);
    });
  });

  doc.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var k = e.key;
    var onControl = e.target.closest && e.target.closest("a, button");
    var next;
    if (k === "ArrowDown" || k === "PageDown") next = current + 1;
    else if (k === "ArrowUp" || k === "PageUp") next = current - 1;
    else if (k === " " && !onControl) next = e.shiftKey ? current - 1 : current + 1;
    else if (k === "Home") next = 0;
    else if (k === "End") next = scenes.length - 1;
    else return;
    e.preventDefault();
    if (!opened) {
      openDoors();
      return;
    }
    next = Math.max(0, Math.min(scenes.length - 1, next));
    go(next);
    // focus travels with the scene, so Tab and Enter act on what is on screen, not on the scene left behind
    var a = doc.activeElement;
    if (a && story.contains(a) && !scenes[next].contains(a)) scenes[next].focus({ preventScroll: true });
  });

  // after a resize or a turn of the phone, come back to the scene that was on screen. It is noted at
  // the first resize event, before the scroll position gets clamped to the new size (a phone turned
  // sideways at a late scene would otherwise end up on the last one).
  var resizeTimer;
  var keep = -1;
  window.addEventListener("resize", function () {
    if (keep < 0) keep = current;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (opened && keep >= 0) scenes[keep].scrollIntoView({ block: "start" });
      keep = -1;
      foils.forEach(function (f) { f.resize(); });
    }, 160);
  });

  settle();

  // reached only if setup ran without errors; otherwise the inline fallback shows the plain page on load
  window.haReady = true;
})();
