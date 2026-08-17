import { SeaAudio } from "./audio.js";
import {
  BAIT,
  DEX_GOAL,
  FISH,
  SPOTS,
  buyLine,
  buyRod,
  canStartCast,
  castLine,
  createGame,
  dexCount,
  enterFishing,
  getOutcome,
  restDay,
  returnToHub,
  selectBait,
  selectSpot,
  summarize,
  sweetZone,
  updateFishing,
} from "./game/rules.js";
import { loadProgress, saveBest, saveProgress } from "./game/persist.js";

const $ = (selector) => document.querySelector(selector);
const WIDTH = 390;
const HEIGHT = 320;

const audio = new SeaAudio();
const sprites = Object.fromEntries(
  [
    "fish_green_outline.png",
    "fish_blue_outline.png",
    "fish_brown_outline.png",
    "fish_grey_long_b_outline.png",
    "fish_orange_outline.png",
    "fish_red.png",
    "seaweed_green_b_outline.png",
    "seaweed_pink_a.png",
    "terrain_sand_top_c_outline.png",
    "background_seaweed_a.png",
  ].map((name) => {
    const image = new Image();
    image.src = `./assets/art/${name}`;
    return [name, image];
  }),
);

let game = createGame({ seed: Date.now() });
let progress = { save: null, best: 0 };
let reeling = false;
let running = false;
let paused = false;
let last = performance.now();
let toastTimer = 0;

const canvas = $("#scene");
const ctx = canvas.getContext("2d");

function showToast(text) {
  const toast = $("#toast");
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function setMessage(text) {
  $("#message").textContent = text;
}

function renderHud() {
  const summary = summarize(game);
  $("#hud").innerHTML = `
    <div class="stat"><span>第幾天</span><strong>${summary.day}/${summary.maxDays}</strong></div>
    <div class="stat"><span>天候</span><strong>${summary.weather}</strong></div>
    <div class="stat"><span>金幣</span><strong>${summary.coins}</strong></div>
    <div class="stat"><span>體力</span><strong>${summary.stamina}</strong></div>
    <div class="stat"><span>圖鑑</span><strong>${summary.dex}/${summary.dexGoal}</strong></div>
    <div class="stat"><span>釣竿</span><strong>Lv.${summary.rod}</strong></div>
    <div class="stat"><span>魚線</span><strong>Lv.${summary.line}</strong></div>
    <div class="stat"><span>餌</span><strong>${summary.bait}</strong></div>
  `;
}

function renderSpots() {
  $("#spot-row").innerHTML = SPOTS.map(
    (spot, index) => `
      <button type="button" data-spot="${index}" class="${game.spot === index ? "selected" : ""}">
        ${spot.name}
      </button>
    `,
  ).join("");
}

function renderBait() {
  $("#bait-row").innerHTML = Object.values(BAIT).map(
    (bait) => `
      <button type="button" data-bait="${bait.id}" class="${game.equipment.bait === bait.id ? "selected" : ""}">
        ${bait.name}${bait.cost ? ` · ${bait.cost}` : ""}
      </button>
    `,
  ).join("");
}

function renderDex() {
  $("#dex-grid").innerHTML = FISH.map((fish) => {
    const entry = game.dex[fish.id];
    const locked = !entry;
    return `
      <article class="dex-card ${locked ? "locked" : ""}">
        <img src="./assets/art/${fish.sprite}" alt="" />
        <strong>${fish.name}</strong>
        <span>${locked ? "未收錄" : `${entry.count} 尾 · 最大 ${entry.bestWeight.toFixed(1)} kg`}</span>
      </article>
    `;
  }).join("");
}

function renderHub() {
  renderHud();
  renderSpots();
  renderBait();
  renderDex();
  setMessage(game.message);
  $("#hub").hidden = false;
  $("#playfield").hidden = true;
  $("#end").hidden = true;
}

function renderPlayfield() {
  renderHud();
  setMessage(game.message);
  $("#hub").hidden = true;
  $("#playfield").hidden = false;
  $("#end").hidden = true;
  syncTensionUi();
}

function renderEnd() {
  renderHud();
  const won = getOutcome(game) === "won";
  $("#end-title").textContent = won ? "圖鑑完成！" : "本季結束";
  $("#end-copy").textContent = game.message;
  $("#hub").hidden = true;
  $("#playfield").hidden = true;
  $("#end").hidden = false;
}

function syncTensionUi() {
  const session = game.session;
  const phase = session?.phase ?? "idle";
  const labels = {
    idle: "待機",
    dropping: "下沉",
    waiting: "等咬",
    fighting: "搏魚",
    landed: "入護",
    failed: "收竿",
  };
  $("#phase-label").textContent = labels[phase] ?? "待機";
  $("#cast-btn").disabled = !canStartCast(game) || phase === "dropping" || phase === "waiting" || phase === "fighting";
  $("#reel-btn").disabled = phase !== "fighting";

  const zone = sweetZone(game.equipment, game.weather);
  $("#tension-sweet").style.left = `${zone.low}%`;
  $("#tension-sweet").style.width = `${zone.high - zone.low}%`;
  const tension = session?.tension ?? 0;
  $("#tension-fill").style.width = `${tension}%`;
}

function handleEvents(events) {
  for (const event of events) {
    if (event.type === "waiting") audio.play("splash");
    if (event.type === "bite") audio.play("bite");
    if (event.type === "caught") audio.play("catch");
    if (event.type === "snap") audio.play("snap");
    if (event.type === "miss" || event.type === "escape") audio.play("click");
  }
}

async function persist() {
  try {
    await saveProgress(game);
    progress.best = await saveBest(dexCount(game), progress.best);
  } catch {
    showToast("存檔同步失敗，仍可繼續玩。");
  }
}

function drawBackground(spotIndex) {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  if (spotIndex === 0) {
    gradient.addColorStop(0, "#89d4ef");
    gradient.addColorStop(0.45, "#2f8ea8");
    gradient.addColorStop(1, "#12465a");
  } else if (spotIndex === 1) {
    gradient.addColorStop(0, "#7ec6a8");
    gradient.addColorStop(0.5, "#2d7258");
    gradient.addColorStop(1, "#173628");
  } else {
    gradient.addColorStop(0, "#6ea7d8");
    gradient.addColorStop(0.45, "#1f4d78");
    gradient.addColorStop(1, "#0a2038");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const sand = sprites["terrain_sand_top_c_outline.png"];
  for (let x = -10; x < WIDTH; x += 64) {
    if (sand.complete) ctx.drawImage(sand, x, HEIGHT - 36, 68, 42);
  }

  const decor =
    spotIndex === 1
      ? [
          ["background_seaweed_a.png", 20, 90, 120, 80],
          ["seaweed_pink_a.png", 280, 70, 48, 88],
          ["seaweed_green_b_outline.png", 180, 60, 42, 74],
        ]
      : [
          ["seaweed_green_b_outline.png", 24, 74, 42, 74],
          ["seaweed_pink_a.png", 300, 88, 48, 88],
        ];
  for (const [name, x, y, w, h] of decor) {
    const image = sprites[name];
    if (image?.complete) ctx.drawImage(image, x, HEIGHT - y - h, w, h);
  }
}

function drawScene() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground(game.spot);

  const session = game.session;
  const rodX = WIDTH * 0.56;
  ctx.strokeStyle = "#e8f7ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rodX, 24);
  ctx.lineTo(rodX, 36 + (session?.depth ?? 0) * 1.8);
  ctx.stroke();

  if (session?.hooked && (session.phase === "fighting" || session.phase === "landed")) {
    const fish = session.hooked;
    const image = sprites[fish.sprite];
    const y = 80 + (session.fishDistance / 100) * 120;
    if (image?.complete) ctx.drawImage(image, rodX - 28, y, 56, 34);
  }

  ctx.fillStyle = "#ffffffcc";
  ctx.font = "14px sans-serif";
  ctx.fillText(SPOTS[game.spot].name, 12, 24);
  ctx.fillText(`天候 ${game.weather.name}`, 12, 44);
}

function tick(now) {
  if (running && !paused && game.screen === "fishing" && game.session) {
    const dt = Math.min(0.05, (now - last) / 1000);
    const out = updateFishing(game, dt, reeling);
    game = out.game;
    handleEvents(out.events);
    if (getOutcome(game) !== "playing") {
      running = false;
      void persist();
      renderEnd();
    } else {
      syncTensionUi();
      setMessage(game.message);
    }
  }
  last = now;
  if (game.screen === "fishing") drawScene();
  requestAnimationFrame(tick);
}

function resetInput() {
  reeling = false;
  $("#reel-btn")?.setAttribute("aria-pressed", "false");
}

function suspend() {
  paused = true;
  resetInput();
  audio.suspend();
}

function resume() {
  paused = false;
  last = performance.now();
  audio.resume();
}

function bindReelButton() {
  const reelBtn = $("#reel-btn");
  const startReel = (event) => {
    if (game.screen !== "fishing" || game.session?.phase !== "fighting") return;
    reeling = true;
    reelBtn.setAttribute("aria-pressed", "true");
    reelBtn.setPointerCapture(event.pointerId);
  };
  const stopReel = () => {
    reeling = false;
    reelBtn.setAttribute("aria-pressed", "false");
  };
  reelBtn.addEventListener("pointerdown", startReel);
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    reelBtn.addEventListener(type, stopReel);
  }
}

function wireUi() {
  $("#start-btn").addEventListener("click", async () => {
    await audio.start();
    $("#intro").hidden = true;
    $("#game").hidden = false;
    running = true;
    renderHub();
  });

  $("#mute-btn").addEventListener("click", () => {
    audio.setEnabled(!audio.enabled);
    $("#mute-btn").setAttribute("aria-pressed", String(!audio.enabled));
    $("#mute-btn").textContent = audio.enabled ? "♫ 音效" : "♫ 靜音";
  });

  $("#spot-row").addEventListener("click", (event) => {
    const button = event.target.closest("[data-spot]");
    if (!button) return;
    game = selectSpot(game, Number(button.dataset.spot));
    renderHub();
    audio.play("click");
  });

  $("#bait-row").addEventListener("click", (event) => {
    const button = event.target.closest("[data-bait]");
    if (!button) return;
    game = selectBait(game, button.dataset.bait);
    renderHub();
    audio.play("click");
  });

  $("#upgrade-rod").addEventListener("click", () => {
    game = buyRod(game);
    renderHub();
    audio.play("click");
  });

  $("#upgrade-line").addEventListener("click", () => {
    game = buyLine(game);
    renderHub();
    audio.play("click");
  });

  $("#enter-fish").addEventListener("click", () => {
    game = enterFishing(game);
    renderPlayfield();
    audio.play("click");
  });

  $("#rest-day").addEventListener("click", () => {
    game = restDay(game);
    void persist();
    if (getOutcome(game) !== "playing") renderEnd();
    else renderHub();
    audio.play("click");
  });

  $("#cast-btn").addEventListener("click", () => {
    game = castLine(game);
    syncTensionUi();
    setMessage(game.message);
    audio.play("splash");
  });

  $("#back-hub").addEventListener("click", () => {
    resetInput();
    game = returnToHub(game);
    renderHub();
    audio.play("click");
  });

  $("#restart-btn").addEventListener("click", () => {
    game = createGame({ seed: Date.now() });
    running = true;
    renderHub();
    audio.play("click");
  });

  bindReelButton();

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      if (game.screen === "fishing" && game.session?.phase === "fighting") {
        reeling = true;
        $("#reel-btn").setAttribute("aria-pressed", "true");
      } else if (canStartCast(game)) {
        game = castLine(game);
        syncTensionUi();
        setMessage(game.message);
        audio.play("splash");
      }
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.code === "Space") resetInput();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") suspend();
    else resume();
  });
  window.addEventListener("pagehide", suspend);
}

async function boot() {
  if (window.PG) {
    await window.PG.ready;
    progress = await loadProgress();
    if (progress.save?.outcome === "playing") {
      game = progress.save;
    }
  }
  wireUi();
  renderHub();
  requestAnimationFrame(tick);
}

boot();
