const SAVE_URL = "/api/kv/seacast:save";
const BEST_URL = "/api/kv/seacast:best";

async function readText(url, fetcher) {
  try {
    const response = await fetcher(url);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function loadProgress(fetcher = fetch) {
  const [saveText, bestText] = await Promise.all([
    readText(SAVE_URL, fetcher),
    readText(BEST_URL, fetcher),
  ]);
  let save = null;
  try {
    if (saveText) save = JSON.parse(saveText);
  } catch {
    save = null;
  }
  const best = Number(bestText);
  return {
    save: save && typeof save === "object" ? save : null,
    best: Number.isFinite(best) && best >= 0 ? best : 0,
  };
}

export async function saveProgress(game, fetcher = fetch) {
  try {
    await fetcher(SAVE_URL, {
      method: "PUT",
      body: JSON.stringify(game),
    });
  } catch {
    // Host KV may be unavailable in static preview.
  }
}

export async function saveBest(dexCount, currentBest, fetcher = fetch) {
  const next = Math.max(dexCount, currentBest);
  if (next <= currentBest) return currentBest;
  try {
    await fetcher(BEST_URL, { method: "PUT", body: String(next) });
  } catch {
    // Continue playing when sync fails.
  }
  return next;
}
