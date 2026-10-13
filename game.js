// Signal Lost: a tiny endless runner for when the internet is down.
// A backpacker runs along the road; jump over suitcases, cones and low paper planes.
// Space / Arrow Up / W / tap to jump. Plain canvas, no libraries, works offline.

(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var status = document.getElementById("status");

  // Game world in logical pixels; the canvas is scaled to fit its box
  var W = 600;
  var H = 160;
  var GROUND = 132;
  var GRAVITY = 0.62;
  var JUMP = -10.8;
  var START_SPEED = 5.5;
  var MAX_SPEED = 12;
  var BEST_KEY = "signal-lost-best";

  var colors = {};
  var state, player, obstacles, groundDashes, speed, score, best, spawnIn, lastTime, frame;

  function readColors() {
    var css = getComputedStyle(document.documentElement);
    colors.ink = css.getPropertyValue("--ink").trim() || "#18181b";
    colors.muted = css.getPropertyValue("--muted").trim() || "#71717a";
    colors.accent = css.getPropertyValue("--accent").trim() || "#ea580c";
  }

  function loadBest() {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch (e) {
      return 0; // storage blocked (private mode, sandboxed frame)
    }
  }

  function saveBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(value));
    } catch (e) {
      // ignore
    }
  }

  function reset() {
    state = "ready";
    player = { x: 48, y: GROUND, vy: 0, w: 18, h: 30, grounded: true };
    obstacles = [];
    groundDashes = [];
    for (var i = 0; i < 12; i++) groundDashes.push({ x: i * 55 + Math.random() * 30, w: 6 + Math.random() * 14 });
    speed = START_SPEED;
    score = 0;
    spawnIn = 60;
    frame = 0;
    draw();
  }

  function resize() {
    var ratio = window.devicePixelRatio || 1;
    var width = canvas.clientWidth || W;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(width * (H / W) * ratio);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    draw();
  }

  /* ---------- Input ---------- */

  function jump() {
    if (state === "over") {
      reset();
      start();
      return;
    }
    if (state === "ready") start();
    if (player.grounded) {
      player.vy = JUMP;
      player.grounded = false;
    }
  }

  function start() {
    state = "running";
    status.textContent = "";
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  document.addEventListener("keydown", function (e) {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault(); // don't scroll the page
      if (!e.repeat) jump();
    }
  });
  canvas.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    canvas.focus();
    jump();
  });

  // Pause when the tab is hidden so the runner doesn't crash off-screen
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && state === "running") {
      state = "paused";
    } else if (!document.hidden && state === "paused") {
      start();
    }
  });

  /* ---------- Obstacles ---------- */

  function spawn() {
    var roll = Math.random();
    if (score > 250 && roll < 0.22) {
      // Paper plane gliding low enough that you have to hop it
      obstacles.push({ kind: "plane", x: W + 10, y: GROUND - 24 - Math.random() * 4, w: 26, h: 10 });
    } else if (roll < 0.55) {
      obstacles.push({ kind: "suitcase", x: W + 10, y: GROUND, w: 18 + Math.round(Math.random()) * 8, h: 22 });
    } else {
      var count = score > 400 && Math.random() < 0.35 ? 2 : 1;
      for (var i = 0; i < count; i++) obstacles.push({ kind: "cone", x: W + 10 + i * 16, y: GROUND, w: 13, h: 20 });
    }
    // Gap shrinks a little as the speed rises, with some randomness
    spawnIn = Math.round(55 + Math.random() * 55 - speed * 1.5);
  }

  function hits(o) {
    var pad = 4; // forgiving edges
    var top = o.kind === "plane" ? o.y : o.y - o.h;
    var px1 = player.x + pad, px2 = player.x + player.w - pad;
    var py1 = player.y - player.h + pad, py2 = player.y - 2;
    return px1 < o.x + o.w - pad && px2 > o.x + pad && py1 < top + o.h - 2 && py2 > top + 2;
  }

  /* ---------- Loop ---------- */

  function loop(now) {
    if (state !== "running") return;
    var step = Math.min((now - lastTime) / (1000 / 60), 3); // 1 = one frame at 60fps
    lastTime = now;
    update(step);
    draw();
    if (state === "running") requestAnimationFrame(loop);
  }

  function update(step) {
    frame += step;
    speed = Math.min(MAX_SPEED, START_SPEED + score / 260);
    score += speed * 0.03 * step;

    player.vy += GRAVITY * step;
    player.y += player.vy * step;
    if (player.y >= GROUND) {
      player.y = GROUND;
      player.vy = 0;
      player.grounded = true;
    }

    for (var i = 0; i < groundDashes.length; i++) {
      var d = groundDashes[i];
      d.x -= speed * step;
      if (d.x + d.w < 0) {
        d.x += W + 40;
        d.w = 6 + Math.random() * 14;
      }
    }

    spawnIn -= step;
    if (spawnIn <= 0) spawn();

    for (var j = obstacles.length - 1; j >= 0; j--) {
      var o = obstacles[j];
      o.x -= (o.kind === "plane" ? speed * 1.15 : speed) * step;
      if (o.x + o.w < 0) obstacles.splice(j, 1);
      else if (hits(o)) return gameOver();
    }
  }

  function gameOver() {
    state = "over";
    var final = Math.floor(score);
    if (final > best) {
      best = final;
      saveBest(best);
    }
    status.textContent = "Game over. Score " + final + ", best " + best + ". Press Space or tap to run again.";
    draw();
  }

  /* ---------- Drawing ---------- */

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // Road
    ctx.fillStyle = colors.muted;
    ctx.fillRect(0, GROUND, W, 1.5);
    for (var i = 0; i < groundDashes.length; i++) {
      ctx.fillRect(groundDashes[i].x, GROUND + 7, groundDashes[i].w, 1.5);
    }

    for (var j = 0; j < obstacles.length; j++) drawObstacle(obstacles[j]);
    drawPlayer();

    // Score, top right, like the classic
    ctx.fillStyle = colors.muted;
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "right";
    var text = (best ? "HI " + pad5(best) + "  " : "") + pad5(Math.floor(score));
    ctx.fillText(text, W - 8, 18);

    ctx.textAlign = "center";
    if (state === "ready") {
      ctx.fillStyle = colors.ink;
      ctx.fillText("Press Space or tap to start", W / 2, 64);
    } else if (state === "over") {
      ctx.fillStyle = colors.ink;
      ctx.font = "bold 14px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("SIGNAL LOST", W / 2, 58);
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = colors.muted;
      ctx.fillText("Space or tap to try again", W / 2, 78);
    } else if (state === "paused") {
      ctx.fillStyle = colors.muted;
      ctx.fillText("Paused", W / 2, 64);
    }
  }

  function pad5(n) {
    return ("00000" + n).slice(-5);
  }

  function drawPlayer() {
    var x = Math.round(player.x);
    var y = Math.round(player.y);
    var running = state === "running" && player.grounded;
    var stride = running ? Math.floor(frame / 5) % 2 : 0;

    // Legs
    ctx.fillStyle = colors.ink;
    if (player.grounded) {
      ctx.fillRect(x + 5, y - 8, 3, stride ? 8 : 6);
      ctx.fillRect(x + 11, y - 8, 3, stride ? 6 : 8);
    } else {
      ctx.fillRect(x + 4, y - 8, 3, 5); // tucked mid-jump
      ctx.fillRect(x + 12, y - 9, 3, 5);
    }
    // Body (orange jacket) and head
    ctx.fillStyle = colors.accent;
    ctx.fillRect(x + 4, y - 21, 12, 14);
    ctx.fillStyle = colors.ink;
    ctx.fillRect(x + 6, y - 30, 9, 9);
    // Backpack
    ctx.fillRect(x, y - 20, 5, 11);
    // Arm swinging
    ctx.fillRect(x + (stride ? 14 : 12), y - 17, 3, 7);
  }

  function drawObstacle(o) {
    var x = Math.round(o.x);
    ctx.fillStyle = colors.ink;
    if (o.kind === "suitcase") {
      var top = o.y - o.h;
      ctx.fillRect(x, top, o.w, o.h); // case
      ctx.fillRect(x + o.w / 2 - 4, top - 4, 8, 2); // handle
      ctx.fillRect(x + o.w / 2 - 4, top - 4, 2, 4);
      ctx.fillRect(x + o.w / 2 + 2, top - 4, 2, 4);
      ctx.fillStyle = colors.accent; // luggage tag
      ctx.fillRect(x + 3, top + 4, 4, 6);
    } else if (o.kind === "cone") {
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.moveTo(x + o.w / 2, o.y - o.h);
      ctx.lineTo(x + o.w, o.y - 3);
      ctx.lineTo(x, o.y - 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = colors.ink;
      ctx.fillRect(x - 2, o.y - 3, o.w + 4, 3); // base
    } else {
      // Paper plane
      var flap = Math.floor(frame / 8) % 2;
      ctx.beginPath();
      ctx.moveTo(x, o.y + o.h / 2);
      ctx.lineTo(x + o.w, o.y + (flap ? 0 : 2));
      ctx.lineTo(x + o.w * 0.55, o.y + o.h);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* ---------- Start ---------- */

  readColors();
  if (window.matchMedia) {
    var scheme = window.matchMedia("(prefers-color-scheme: dark)");
    var onScheme = function () {
      readColors();
      draw();
    };
    if (scheme.addEventListener) scheme.addEventListener("change", onScheme);
  }
  best = loadBest();
  reset();
  resize();
  window.addEventListener("resize", resize);
})();
