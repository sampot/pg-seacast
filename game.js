/** pg-seacast — 港邊釣夢 (開放釣魚養成) */

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function mulberry32(a) {
  return function() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function deep(o) { return JSON.parse(JSON.stringify(o)); }


export function createGame({ seed = 1 } = {}) {
  return { seed, turn: 0, score: 0, level: 1, meter: 0, resources: 10, flags: {}, log: ["港邊釣夢：拋竿"], outcome: "playing", msg: "港邊釣夢：拋竿" };
}
export function getLegalActions(s) {
  if (s.outcome !== "playing") return [];
  return ["cast","reel","changeSpot","upgrade"];
}
export function applyAction(state, action) {
  const s = deep(state);
  if (s.outcome !== "playing") return s;
  const rnd = mulberry32(s.seed + s.turn * 19);
  s.turn++;
  
  s.flags.dex = s.flags.dex ?? [];
  s.flags.rod = s.flags.rod ?? 1;
  if (action === "upgrade") { if (s.resources >= 5) { s.resources -= 5; s.flags.rod++; s.msg = "強化釣竿"; } else s.msg = "錢不夠"; }
  else if (action === "changeSpot") { s.flags.spot = ((s.flags.spot||0)+1)%3; s.msg = "換漁場 "+s.flags.spot; }
  else if (action === "cast") { s.msg = "等待咬鉤…"; s.flags.bite = rnd() < 0.5 + s.flags.rod*0.1; }
  else {
    if (!s.flags.bite) s.msg = "空竿";
    else {
      const fish = ["虱目魚","白帶魚","石斑","鎖管"][Math.floor(rnd()*4)];
      if (!s.flags.dex.includes(fish)) s.flags.dex.push(fish);
      s.score += 20; s.meter = s.flags.dex.length * 20; s.resources += 2; s.msg = "釣上 "+fish;
      s.flags.bite = false;
    }
  }
  if (s.flags.dex.length >= 4) { s.level = 5; s.meter = 100; }

  if (s.resources < 0) s.resources = 0;
  if (s.outcome === "playing" && s.level >= 5 && s.meter >= 100) {
    s.outcome = "won";
    s.msg = "目標達成！";
  }
  if (s.outcome === "playing" && (s.resources <= 0 && s.meter < 20 && s.turn > 8)) {
    s.outcome = "lost";
    s.msg = "資源崩盤";
  }
  return s;
}
export function summarize(s) {
  return { turn: s.turn, level: s.level, meter: s.meter, score: s.score, resources: s.resources, msg: s.msg, outcome: s.outcome, flags: s.flags };
}
export function getOutcome(s) { return s.outcome; }

