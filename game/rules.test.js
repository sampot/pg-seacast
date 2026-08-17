import { describe, expect, it, vi } from "vitest";
import {
  BAIT,
  DEX_GOAL,
  FISH,
  SPOTS,
  buyLine,
  buyRod,
  canAffordUpgrade,
  canStartCast,
  castLine,
  createGame,
  createSession,
  dexComplete,
  dexCount,
  enterFishing,
  getOutcome,
  random01,
  restDay,
  returnToHub,
  selectBait,
  selectSpot,
  startCast,
  summarize,
  sweetZone,
  tensionLimit,
  updateFishing,
  weatherForDay,
} from "./rules.js";

describe("seacast rules", () => {
  it("creates a structured season with weather, equipment, and dex", () => {
    const game = createGame({ seed: 42 });
    expect(game.day).toBe(1);
    expect(game.maxDays).toBe(10);
    expect(game.spot).toBe(0);
    expect(game.weather).toEqual(weatherForDay(42, 1));
    expect(game.equipment).toEqual({ rod: 1, line: 1, bait: "worms" });
    expect(game.dex).toEqual({});
    expect(game.outcome).toBe("playing");
  });

  it("keeps weather deterministic per seed and day", () => {
    expect(weatherForDay(99, 3)).toEqual(weatherForDay(99, 3));
    expect(weatherForDay(99, 3)).not.toEqual(weatherForDay(99, 4));
  });

  it("maps six fish across three spots", () => {
    expect(FISH).toHaveLength(DEX_GOAL);
    expect(new Set(FISH.map((fish) => fish.spot))).toEqual(new Set([0, 1, 2]));
    expect(SPOTS).toHaveLength(3);
  });

  it("selects spots and blocks invalid indices", () => {
    const game = selectSpot(createGame({ seed: 1 }), 2);
    expect(game.spot).toBe(2);
    expect(game.message).toMatch(/外海礁/);
    expect(() => selectSpot(game, 9)).toThrow(/漁場/);
  });

  it("upgrades rod and line when coins allow", () => {
    let game = createGame({ seed: 2 });
    game = { ...game, coins: 30 };
    game = buyRod(game);
    expect(game.equipment.rod).toBe(2);
    expect(game.coins).toBe(24);
    game = buyLine(game);
    expect(game.equipment.line).toBe(2);
    expect(game.coins).toBe(19);
    expect(canAffordUpgrade(game, "rod")).toBe(true);
  });

  it("refuses upgrades without enough coins", () => {
    const game = buyRod({ ...createGame({ seed: 3 }), coins: 4 });
    expect(game.equipment.rod).toBe(1);
    expect(game.message).toMatch(/不足/);
  });

  it("switches bait and deducts cost", () => {
    let game = createGame({ seed: 4 });
    game = { ...game, coins: 12 };
    game = selectBait(game, "shrimp");
    expect(game.equipment.bait).toBe("shrimp");
    expect(game.coins).toBe(8);
    expect(BAIT.shrimp.biteBonus).toBeGreaterThan(0);
  });

  it("starts a cast only with enough stamina", () => {
    let game = enterFishing(createGame({ seed: 5 }));
    expect(canStartCast(game)).toBe(true);
    game = castLine(game);
    expect(game.session.phase).toBe("dropping");
    expect(game.stamina).toBeLessThan(100);
    game = { ...game, stamina: 5 };
    expect(canStartCast(game)).toBe(false);
  });

  it("drops the line then waits for a bite", () => {
    let game = castLine(enterFishing(createGame({ seed: 6 })));
    let depth = 0;
    for (let i = 0; i < 30; i += 1) {
      const out = updateFishing(game, 0.08, false, () => 1);
      game = out.game;
      depth = game.session.depth;
      if (game.session.phase === "waiting") break;
    }
    expect(depth).toBe(100);
    expect(game.session.phase).toBe("waiting");
  });

  it("hooks a fish when the bite roll succeeds", () => {
    let game = castLine(enterFishing(createGame({ seed: 7 })));
    while (game.session.phase === "dropping") {
      game = updateFishing(game, 0.1, false, () => 1).game;
    }
    const hooked = updateFishing(game, 0.2, false, () => 0).game;
    expect(hooked.session.phase).toBe("fighting");
    expect(hooked.session.hooked).toBeTruthy();
  });

  it("lands a fish when reeled in with controlled tension", () => {
    let game = castLine(enterFishing(createGame({ seed: 8 })));
    while (game.session.phase !== "fighting") {
      game = updateFishing(game, 0.12, false, () => 0).game;
    }
    game = { ...game, session: { ...game.session, fishDistance: 12, tension: 40 } };
    for (let i = 0; i < 40; i += 1) {
      const out = updateFishing(game, 0.08, true, () => 0.1);
      game = out.game;
      if (game.session.phase === "landed") break;
    }
    expect(game.session.phase).toBe("landed");
    expect(dexCount(game)).toBe(1);
    expect(game.coins).toBeGreaterThan(10);
  });

  it("breaks the line when tension exceeds the equipment limit", () => {
    let game = castLine(enterFishing(createGame({ seed: 9 })));
    game = {
      ...game,
      session: {
        ...createSession(),
        phase: "fighting",
        hooked: FISH[5],
        tension: 95,
        fishDistance: 50,
      },
    };
    const out = updateFishing(game, 0.1, true, () => 1);
    expect(out.events.some((event) => event.type === "snap")).toBe(true);
    expect(out.game.message).toMatch(/斷/);
    expect(out.game.stamina).toBeLessThan(100 - 12);
  });

  it("declares victory when the dex is complete", () => {
    let game = createGame({ seed: 10 });
    const dex = Object.fromEntries(
      FISH.slice(0, DEX_GOAL - 1).map((fish) => [fish.id, { count: 1, bestWeight: 1 }]),
    );
    game = { ...game, dex };
    game = finalizeViaCatch(game, FISH[DEX_GOAL - 1]);
    expect(dexComplete(game)).toBe(true);
    expect(getOutcome(game)).toBe("won");
  });

  it("ends the season when days run out without a full dex", () => {
    let game = createGame({ seed: 11 });
    game = { ...game, day: game.maxDays };
    game = restDay(game);
    expect(getOutcome(game)).toBe("lost");
    expect(game.message).toMatch(/季節結束/);
  });

  it("restores stamina and advances weather on a new day", () => {
    let game = createGame({ seed: 12 });
    game = { ...game, stamina: 20, day: 2 };
    game = restDay(game);
    expect(game.day).toBe(3);
    expect(game.stamina).toBeGreaterThan(20);
    expect(game.weather).toEqual(weatherForDay(12, 3));
  });

  it("returns to hub and clears active session", () => {
    let game = enterFishing(createGame({ seed: 13 }));
    game = castLine(game);
    game = returnToHub(game);
    expect(game.screen).toBe("hub");
    expect(game.session.phase).toBe("idle");
  });

  it("computes sweet zone and tension limit from equipment", () => {
    const weather = weatherForDay(1, 1);
    const lowGear = sweetZone({ rod: 1, line: 1 }, weather);
    const highGear = sweetZone({ rod: 3, line: 3 }, weather);
    expect(highGear.high - highGear.low).toBeGreaterThan(lowGear.high - lowGear.low);
    expect(tensionLimit({ line: 3 })).toBeGreaterThan(tensionLimit({ line: 1 }));
  });

  it("summarizes hud fields for the UI", () => {
    const summary = summarize(createGame({ seed: 14 }));
    expect(summary.dexGoal).toBe(DEX_GOAL);
    expect(summary.bait).toBe("沙蚕");
    expect(summary.outcome).toBe("playing");
  });

  it("uses seeded random helper consistently", () => {
    expect(random01(77, 5)).toBe(random01(77, 5));
    expect(random01(77, 5)).not.toBe(random01(77, 6));
  });
});

function finalizeViaCatch(game, fish) {
  return {
    ...game,
    dex: {
      ...game.dex,
      [fish.id]: { count: 1, bestWeight: fish.weight[1] },
    },
    outcome: "won",
    screen: "end",
    message: "六種魚完成圖鑑，海洋館邀你策展！",
  };
}

import { loadProgress, saveBest, saveProgress } from "./persist.js";

describe("seacast persistence", () => {
  it("loads save and best from KV keys", async () => {
    const fetcher = vi.fn(async (url) => ({
      ok: true,
      text: async () =>
        url.endsWith(":best")
          ? "4"
          : JSON.stringify({ day: 2, coins: 9 }),
    }));
    await expect(loadProgress(fetcher)).resolves.toEqual({
      save: { day: 2, coins: 9 },
      best: 4,
    });
  });

  it("recovers from unavailable or malformed KV", async () => {
    const offline = vi.fn(async () => {
      throw new Error("offline");
    });
    const malformed = vi.fn(async (url) => ({
      ok: true,
      text: async () => (url.endsWith(":best") ? "bad" : "{"),
    }));
    await expect(loadProgress(offline)).resolves.toEqual({ save: null, best: 0 });
    await expect(loadProgress(malformed)).resolves.toEqual({ save: null, best: 0 });
  });

  it("writes save JSON and only bumps best when improved", async () => {
    const fetcher = vi.fn(async () => ({ ok: true }));
    await saveProgress({ day: 1 }, fetcher);
    expect(fetcher).toHaveBeenCalledWith("/api/kv/seacast:save", {
      method: "PUT",
      body: JSON.stringify({ day: 1 }),
    });
    await expect(saveBest(3, 5, fetcher)).resolves.toBe(5);
    await expect(saveBest(6, 5, fetcher)).resolves.toBe(6);
  });
});
