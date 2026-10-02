// Stan pokoju w Upstash Redis (REST). Zmienne środowiskowe dodaje integracja Upstash/KV z Vercela.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const DEFAULT_TILES = [
  "Wzmianka o Stasiu od Grubej", "Randeczka Iwa", "Iwo zmęczony – praca i życie", "Sprzedaż spółki – bardzo ważna sprawa", "Iwo kwanty",
  "Gruba, pijesz", "Iwo: ja też szukam mieszkania", "Gruba: wzmianka o kebabie", "Kolega się odezwie", "Związek kolegi",
  "Kolega i aplikacja randkowa", "Nina Reich – piłka nożna", "Temat ziółka", "Ania wgapia się", "Iwo wtulony w Anię/Paulę",
  "Iwo pali papierosa", "Zosia Rogalińska – wzmianka", "Wróżka od Franka", "Festiwal", "Temat matchy",
  "Temat pracy z dziećmi", "Gruba się jeszcze nie przeprowadziła", "Gruba urządza mieszkanie", "Iwo opowiada o Walencji", "Dziewczyna z Sopotu pisze do Iwa"
];

async function redis(cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error("redis " + r.status);
  return (await r.json()).map(x => x.result);
}

const shuffle = n => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cleanTiles = t => Array.isArray(t) && t.length === 25 ? t.map(x => String(x ?? "").slice(0, 120)) : null;

async function read(id) {
  const [cfgRaw, done] = await redis([["GET", `b:${id}:cfg`], ["SMEMBERS", `b:${id}:done`]]);
  let cfg = cfgRaw ? JSON.parse(cfgRaw) : null;
  if (!cfg) {
    cfg = { tiles: DEFAULT_TILES, order: shuffle(25), v: 1 };
    await redis([["SET", `b:${id}:cfg`, JSON.stringify(cfg), "NX"]]);
  }
  return { ...cfg, done: done.map(Number) };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!URL_ || !TOKEN) return res.status(500).json({ error: "Brak konfiguracji Redis (KV_REST_API_URL / KV_REST_API_TOKEN)" });
  try {
    const id = String((req.method === "GET" ? req.query.id : req.body?.id) || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);
    if (!id) return res.status(400).json({ error: "Brak kodu pokoju" });

    if (req.method === "POST") {
      const { action, pos, value, tiles } = req.body;
      const ttl = 60 * 60 * 24 * 60; // pokój wygasa po 60 dniach bez aktywności
      if (action === "mark" && Number.isInteger(pos) && pos >= 0 && pos < 25) {
        await redis([[value ? "SADD" : "SREM", `b:${id}:done`, pos], ["EXPIRE", `b:${id}:done`, ttl]]);
      } else if (action === "clear") {
        await redis([["DEL", `b:${id}:done`]]);
      } else if (action === "shuffle" || action === "tiles") {
        const cur = await read(id);
        const next = { tiles: cur.tiles, order: cur.order, v: cur.v + 1 };
        if (action === "shuffle") { next.order = shuffle(25); await redis([["DEL", `b:${id}:done`]]); }
        if (action === "tiles") { const t = cleanTiles(tiles); if (!t) return res.status(400).json({ error: "Potrzeba 25 haseł" }); next.tiles = t; }
        await redis([["SET", `b:${id}:cfg`, JSON.stringify(next), "EX", ttl]]);
      } else return res.status(400).json({ error: "Zła akcja" });
    }
    return res.status(200).json(await read(id));
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
