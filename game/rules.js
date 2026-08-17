export const DEX_GOAL = 6;
export const MAX_DAYS = 10;
export const START_STAMINA = 100;
export const STAMINA_COST = 12;
export const LINE_BREAK_COST = 18;

export const SPOTS = Object.freeze([
  { id: "breakwater", name: "防波堤", shallow: true },
  { id: "mangrove", name: "紅樹林", shallow: false },
  { id: "reef", name: "外海礁", shallow: false },
]);

export const WEATHER_KINDS = Object.freeze([
  { kind: "sunny", name: "晴", biteMod: 1, tensionMod: 1 },
  { kind: "rain", name: "雨", biteMod: 0.72, tensionMod: 0.82 },
  { kind: "wind", name: "風", biteMod: 0.88, tensionMod: 1.28 },
]);

export const FISH = Object.freeze([
  {
    id: "horse-mackerel",
    name: "竹筴魚",
    spot: 0,
    sprite: "fish_green_outline.png",
    rarity: 1,
    coins: 4,
    fight: 0.32,
    bite: 0.62,
    weight: [0.2, 0.6],
  },
  {
    id: "mackerel",
    name: "鯖魚",
    spot: 0,
    sprite: "fish_blue_outline.png",
    rarity: 2,
    coins: 7,
    fight: 0.48,
    bite: 0.42,
    weight: [0.5, 1.2],
  },
  {
    id: "mudskipper",
    name: "彈塗魚",
    spot: 1,
    sprite: "fish_brown_outline.png",
    rarity: 1,
    coins: 5,
    fight: 0.36,
    bite: 0.58,
    weight: [0.1, 0.35],
  },
  {
    id: "mullet",
    name: "烏魚",
    spot: 1,
    sprite: "fish_grey_long_b_outline.png",
    rarity: 2,
    coins: 9,
    fight: 0.54,
    bite: 0.38,
    weight: [0.8, 2.1],
  },
  {
    id: "grouper",
    name: "石斑",
    spot: 2,
    sprite: "fish_orange_outline.png",
    rarity: 2,
    coins: 14,
    fight: 0.68,
    bite: 0.3,
    weight: [1.5, 4.2],
  },
  {
    id: "marlin",
    name: "旗魚",
    spot: 2,
    sprite: "fish_red.png",
    rarity: 3,
    coins: 28,
    fight: 0.86,
    bite: 0.16,
    weight: [5, 16],
  },
]);

export const BAIT = Object.freeze({
  worms: { id: "worms", name: "沙蚕", biteBonus: 0, cost: 0 },
  shrimp: { id: "shrimp", name: "小蝦", biteBonus: 0.14, cost: 4 },
  lure: { id: "lure", name: "擬餌", biteBonus: 0.24, cost: 7 },
});

export const UPGRADE_COST = Object.freeze({
  rod: [0, 6, 14],
  line: [0, 5, 12],
});

const FISH_BY_SPOT = FISH.reduce((map, fish) => {
  (map[fish.spot] ??= []).push(fish);
  return map;
}, {});

function hash(seed, salt) {
  let n = (Number(seed) ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  n ^= n >>> 16;
  n = Math.imul(n, 0x21f0aaad);
  n ^= n >>> 15;
  n = Math.imul(n, 0x735a2d97);
  return (n ^ (n >>> 15)) >>> 0;
}

export function random01(seed, salt) {
  return hash(seed, salt) / 0x100000000;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function weatherForDay(seed, day) {
  const index = Math.floor(random01(seed, day * 17 + 3) * WEATHER_KINDS.length);
  return { ...WEATHER_KINDS[index] };
}

export function fishForSpot(spot) {
  return FISH_BY_SPOT[spot] ?? [];
}

export function createGame({ seed = Date.now() } = {}) {
  const safeSeed = Number(seed) >>> 0;
  return {
    seed: safeSeed,
    day: 1,
    maxDays: MAX_DAYS,
    spot: 0,
    weather: weatherForDay(safeSeed, 1),
    coins: 10,
    stamina: START_STAMINA,
    equipment: { rod: 1, line: 1, bait: "worms" },
    dex: {},
    catches: [],
    session: null,
    screen: "hub",
    outcome: "playing",
    message: "選擇漁場與裝備，拋竿後在張力安全區收線。",
  };
}

export function createSession() {
  return {
    phase: "idle",
    tension: 0,
    depth: 0,
    fishDistance: 100,
    hooked: null,
    timer: 0,
    phaseTime: 0,
    result: null,
  };
}

export function dexCount(game) {
  return Object.keys(game.dex).length;
}

export function dexComplete(game) {
  return dexCount(game) >= DEX_GOAL;
}

export function tensionLimit(equipment) {
  return clamp(78 + equipment.line * 7, 84, 98);
}

export function sweetZone(equipment, weather) {
  const center = 52 - equipment.rod * 2;
  const width = 16 + equipment.line * 2;
  const mod = weather.tensionMod;
  return {
    low: clamp((center - width / 2) * mod, 20, 70),
    high: clamp((center + width / 2) * mod, 45, 88),
  };
}

export function canAffordUpgrade(game, kind) {
  const level = game.equipment[kind];
  if (level >= 3) return false;
  return game.coins >= UPGRADE_COST[kind][level];
}

export function upgradeCost(game, kind) {
  const level = game.equipment[kind];
  if (level >= 3) return null;
  return UPGRADE_COST[kind][level];
}

export function selectSpot(game, spot) {
  if (game.outcome !== "playing") return game;
  if (!Number.isInteger(spot) || spot < 0 || spot >= SPOTS.length) {
    throw new Error("漁場無效");
  }
  return {
    ...game,
    spot,
    message: `移往${SPOTS[spot].name}。天候：${game.weather.name}。`,
  };
}

export function buyRod(game) {
  if (game.outcome !== "playing") return game;
  if (!canAffordUpgrade(game, "rod")) {
    return { ...game, message: "金幣不足或釣竿已滿級。" };
  }
  const cost = upgradeCost(game, "rod");
  return {
    ...game,
    coins: game.coins - cost,
    equipment: { ...game.equipment, rod: game.equipment.rod + 1 },
    message: `釣竿升到 ${game.equipment.rod + 1} 級，收線更穩。`,
  };
}

export function buyLine(game) {
  if (game.outcome !== "playing") return game;
  if (!canAffordUpgrade(game, "line")) {
    return { ...game, message: "金幣不足或魚線已滿級。" };
  }
  const cost = upgradeCost(game, "line");
  return {
    ...game,
    coins: game.coins - cost,
    equipment: { ...game.equipment, line: game.equipment.line + 1 },
    message: `魚線升到 ${game.equipment.line + 1} 級，更耐張力。`,
  };
}

export function selectBait(game, baitId) {
  if (game.outcome !== "playing") return game;
  const bait = BAIT[baitId];
  if (!bait) throw new Error("餌料無效");
  if (game.coins < bait.cost) {
    return { ...game, message: `需要 ${bait.cost} 金幣購買${bait.name}。` };
  }
  return {
    ...game,
    coins: game.coins - bait.cost,
    equipment: { ...game.equipment, bait: baitId },
    message: `換上${bait.name}，咬餌機率提升。`,
  };
}

export function canStartCast(game) {
  return (
    game.outcome === "playing" &&
    game.screen === "fishing" &&
    game.stamina >= STAMINA_COST &&
    (!game.session || game.session.phase === "idle" || game.session.phase === "landed" || game.session.phase === "failed")
  );
}

export function startCast(game) {
  if (!canStartCast(game)) {
    if (game.stamina < STAMINA_COST) {
      return { ...game, message: "體力不足，休息一晚或改日再釣。" };
    }
    return game;
  }
  return {
    ...game,
    stamina: game.stamina - STAMINA_COST,
    session: createSession(),
    message: "魚鉤下沉中…注意浮標。",
  };
}

function pickFish(game, random) {
  const pool = fishForSpot(game.spot);
  const bait = BAIT[game.equipment.bait] ?? BAIT.worms;
  const weather = game.weather;
  const weighted = pool.map((fish, index) => {
    const chance = fish.bite * weather.biteMod * (1 + bait.biteBonus) * (1 / fish.rarity);
    return { fish, chance, index };
  });
  const total = weighted.reduce((sum, item) => sum + item.chance, 0);
  let roll = random() * total;
  for (const item of weighted) {
    roll -= item.chance;
    if (roll <= 0) return item.fish;
  }
  return weighted.at(-1).fish;
}

function finalizeCatch(game, fish, weight) {
  const entry = game.dex[fish.id] ?? { count: 0, bestWeight: 0 };
  const nextDex = {
    ...game.dex,
    [fish.id]: {
      count: entry.count + 1,
      bestWeight: Math.max(entry.bestWeight, weight),
    },
  };
  const catchRecord = {
    fishId: fish.id,
    name: fish.name,
    weight,
    coins: fish.coins,
    day: game.day,
    spot: game.spot,
  };
  const next = {
    ...game,
    coins: game.coins + fish.coins,
    dex: nextDex,
    catches: [...game.catches, catchRecord],
    message: `釣上 ${fish.name}（${weight.toFixed(1)} kg）！+${fish.coins} 金幣`,
  };
  if (dexComplete(next)) {
    next.outcome = "won";
    next.screen = "end";
    next.message = "六種魚完成圖鑑，海洋館邀你策展！";
  }
  return next;
}

function failSession(game, reason, staminaLoss = 0) {
  const stamina = Math.max(0, game.stamina - staminaLoss);
  const next = {
    ...game,
    stamina,
    message: reason,
    session: { ...game.session, phase: "failed", result: reason },
  };
  if (stamina <= 0 && next.outcome === "playing") {
    next.outcome = "lost";
    next.screen = "end";
    next.message = "體力耗盡，本季釣季結束。";
  }
  return next;
}

export function updateFishing(game, dt, reeling, random = Math.random) {
  if (!game.session || game.outcome !== "playing") return { game, events: [] };
  const session = { ...game.session };
  const events = [];
  dt = clamp(dt, 0, 0.12);
  session.timer += dt;
  session.phaseTime += dt;

  const equipment = game.equipment;
  const weather = game.weather;
  const zone = sweetZone(equipment, weather);
  const limit = tensionLimit(equipment);

  if (session.phase === "landed" || session.phase === "failed") {
    return { game, events };
  }

  if (session.phase === "idle") {
    return { game: { ...game, session }, events };
  }

  if (session.phase === "dropping") {
    session.depth = Math.min(100, session.depth + 95 * dt);
    if (session.depth >= 100) {
      session.phase = "waiting";
      session.phaseTime = 0;
      events.push({ type: "waiting" });
    }
    return { game: { ...game, session }, events };
  }

  if (session.phase === "waiting") {
    const bait = BAIT[equipment.bait] ?? BAIT.worms;
    const biteRoll = random();
    const biteChance = 0.55 * weather.biteMod * (1 + bait.biteBonus) * dt;
    if (biteRoll < biteChance) {
      const fish = pickFish(game, random);
      session.hooked = fish;
      session.phase = "fighting";
      session.phaseTime = 0;
      session.tension = 18;
      session.fishDistance = 100;
      events.push({ type: "bite", fish });
      return { game: { ...game, session, message: `${fish.name} 咬鉤！按住收線，張力高就放開。` }, events };
    }
    if (session.phaseTime > 4.5) {
      const next = failSession({ ...game, session }, "這次沒有魚上鉤。");
      events.push({ type: "miss" });
      return { game: next, events };
    }
    return { game: { ...game, session }, events };
  }

  if (session.phase === "fighting" && session.hooked) {
    const fish = session.hooked;
    const fighting = random() < fish.fight;
    if (reeling) {
      session.tension += (fighting ? 1.35 : 0.42) * dt * 28 * weather.tensionMod;
      session.fishDistance = Math.max(0, session.fishDistance - (fighting ? 8 : 22) * dt);
    } else {
      session.tension = Math.max(0, session.tension - 0.95 * dt * 24);
      session.fishDistance = Math.min(100, session.fishDistance + fish.fight * 16 * dt);
    }

    session.tension = clamp(session.tension, 0, 100);

    if (session.tension >= limit) {
      const next = failSession({ ...game, session }, "魚線斷了！", LINE_BREAK_COST);
      events.push({ type: "snap" });
      return { game: next, events };
    }

    if (session.fishDistance >= 100) {
      const next = failSession({ ...game, session }, `${fish.name} 脫鉤逃走了。`);
      events.push({ type: "escape" });
      return { game: next, events };
    }

    if (session.fishDistance <= 0) {
      const weight =
        fish.weight[0] +
        random() * (fish.weight[1] - fish.weight[0]);
      session.phase = "landed";
      session.result = fish;
      events.push({ type: "caught", fish, weight });
      const next = finalizeCatch({ ...game, session }, fish, weight);
      return { game: next, events };
    }

    if (session.tension >= zone.low && session.tension <= zone.high && reeling) {
      session.fishDistance = Math.max(0, session.fishDistance - 4 * dt);
    }
  }

  return { game: { ...game, session }, events };
}

export function castLine(game) {
  if (!canStartCast(game)) return game;
  const withCost = startCast(game);
  if (!withCost.session) return withCost;
  return {
    ...withCost,
    session: { ...withCost.session, phase: "dropping", phaseTime: 0, depth: 0 },
  };
}

export function enterFishing(game) {
  if (game.outcome !== "playing") return game;
  return {
    ...game,
    screen: "fishing",
    session: game.session ?? createSession(),
    message: "按住右下收線；張力進入綠區時魚會靠近。",
  };
}

export function returnToHub(game) {
  if (game.outcome !== "playing") return game;
  return {
    ...game,
    screen: "hub",
    session: createSession(),
    message: "整理裝備，或換個漁場。",
  };
}

export function restDay(game) {
  if (game.outcome !== "playing") return game;
  if (game.day >= game.maxDays) {
    const next = {
      ...game,
      outcome: "lost",
      screen: "end",
      message: "季節結束，圖鑑尚未集齊。",
    };
    return next;
  }
  const nextDay = game.day + 1;
  return {
    ...game,
    day: nextDay,
    weather: weatherForDay(game.seed, nextDay),
    stamina: clamp(game.stamina + 28, 0, START_STAMINA),
    screen: "hub",
    session: createSession(),
    message: `第 ${nextDay} 天。天候：${weatherForDay(game.seed, nextDay).name}。`,
  };
}

export function getOutcome(game) {
  return game.outcome;
}

export function summarize(game) {
  return {
    day: game.day,
    maxDays: game.maxDays,
    spot: SPOTS[game.spot]?.name ?? "",
    weather: game.weather.name,
    coins: game.coins,
    stamina: game.stamina,
    dex: dexCount(game),
    dexGoal: DEX_GOAL,
    rod: game.equipment.rod,
    line: game.equipment.line,
    bait: BAIT[game.equipment.bait]?.name ?? "",
    outcome: game.outcome,
    message: game.message,
  };
}
