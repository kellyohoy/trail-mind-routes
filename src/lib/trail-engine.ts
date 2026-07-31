// Browser-safe route generation + GPX utilities. No map library imports here.

export type LatLng = { lat: number; lng: number };

export type RoutePoint = LatLng & {
  /** metres from start */
  dist: number;
  /** metres above sea level */
  ele: number;
};

export type TrailRef = {
  source: "Trailforks" | "AllTrails";
  name: string;
  difficulty: string;
  rating: number;
  length: number;
  note: string;
  url: string;
};

export type GeneratedRoute = {
  id: string;
  name: string;
  prompt: string;
  vehicle: Vehicle;
  points: RoutePoint[];
  distanceKm: number;
  ascent: number;
  descent: number;
  maxEle: number;
  minEle: number;
  avgGrade: number;
  estMinutes: number;
  difficulty: string;
  surface: string;
  description: string;
  highlights: string[];
  refs: TrailRef[];
};

export type Vehicle = "mtb" | "moto";

/* ---------- deterministic pseudo-random ---------- */

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- prompt parsing ---------- */

const SURFACE_WORDS: Record<string, string> = {
  rocky: "Rock gardens & loose scree",
  root: "Rooty forest loam",
  flow: "Buffed flow loam",
  gravel: "Hardpack gravel",
  sand: "Sandy doubletrack",
  mud: "Greasy clay & mud",
  tarmac: "Mixed tarmac connectors",
  enduro: "Steep chundery enduro",
  singletrack: "Natural singletrack",
};

export function parsePrompt(prompt: string) {
  const p = prompt.toLowerCase();
  const has = (...w: string[]) => w.some((x) => p.includes(x));

  const climbHeavy = has("elevation", "climb", "steep", "mountain", "vertical", "hill");
  const long = has("long", "epic", "all day", "big day", "100");
  const short = has("short", "quick", "lap", "after work");
  const technical = has("rocky", "tech", "gnarly", "enduro", "root", "rough");
  const flowy = has("flow", "smooth", "beginner", "mellow", "easy");

  const surfaceKey = Object.keys(SURFACE_WORDS).find((k) => p.includes(k));
  const surface = surfaceKey ? SURFACE_WORDS[surfaceKey]! : "Mixed singletrack & forest road";

  const placeMatch = prompt.match(/\bnear\s+([A-Za-zÀ-ÿ\s'-]{2,40})/i);
  const place = placeMatch ? placeMatch[1].trim().replace(/[.,].*$/, "") : null;

  return {
    place,
    lengthFactor: long ? 1.9 : short ? 0.55 : 1,
    climbFactor: climbHeavy ? 1.9 : flowy ? 0.5 : 1,
    technical,
    flowy,
    surface,
  };
}

/* ---------- geocoding (OpenStreetMap Nominatim) ---------- */

export async function geocodePlace(place: string): Promise<LatLng | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!json.length) return null;
    return { lat: parseFloat(json[0]!.lat), lng: parseFloat(json[0]!.lon) };
  } catch {
    return null;
  }
}

/* ---------- route synthesis ---------- */

const R = 6371000;

function haversine(a: LatLng, b: LatLng) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function generateRoute(
  prompt: string,
  center: LatLng,
  vehicle: Vehicle,
): GeneratedRoute {
  const cfg = parsePrompt(prompt);
  const rnd = mulberry(hashString(prompt + vehicle + center.lat.toFixed(2)));

  const baseKm = (vehicle === "moto" ? 48 : 22) * cfg.lengthFactor * (0.8 + rnd() * 0.5);
  const radiusM = (baseKm * 1000) / (2 * Math.PI);
  const steps = 220;

  // Wobbly closed loop built from harmonics -> looks like a real trail loop
  const harmonics = Array.from({ length: 4 }, (_, i) => ({
    k: i + 2,
    amp: (0.12 + rnd() * 0.22) / (i + 1),
    phase: rnd() * Math.PI * 2,
  }));

  const baseEle = 240 + rnd() * 900;
  const climbAmp = (vehicle === "moto" ? 260 : 200) * cfg.climbFactor * (0.7 + rnd() * 0.8);

  const raw: LatLng[] = [];
  const eleRaw: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    let r = radiusM;
    for (const h of harmonics) r *= 1 + h.amp * Math.sin(h.k * t + h.phase);

    const lat = center.lat + (r * Math.cos(t)) / 111320;
    const lng =
      center.lng + (r * Math.sin(t)) / (111320 * Math.cos((center.lat * Math.PI) / 180));
    raw.push({ lat, lng });

    // Elevation: one or two big climbs plus terrain noise
    let e =
      baseEle +
      climbAmp * (0.5 - 0.5 * Math.cos(t * (cfg.climbFactor > 1.5 ? 2 : 1))) +
      climbAmp * 0.25 * Math.sin(t * 3 + harmonics[0]!.phase);
    if (cfg.technical) e += 18 * Math.sin(t * 21 + harmonics[1]!.phase);
    if (!cfg.flowy) e += 9 * Math.sin(t * 47);
    eleRaw.push(e);
  }
  raw[raw.length - 1] = raw[0]!;
  eleRaw[eleRaw.length - 1] = eleRaw[0]!;

  const points: RoutePoint[] = [];
  let dist = 0;
  let ascent = 0;
  let descent = 0;
  for (let i = 0; i < raw.length; i++) {
    if (i > 0) {
      dist += haversine(raw[i - 1]!, raw[i]!);
      const d = eleRaw[i]! - eleRaw[i - 1]!;
      if (d > 0) ascent += d;
      else descent -= d;
    }
    points.push({ ...raw[i]!, dist, ele: Math.round(eleRaw[i]!) });
  }

  const distanceKm = dist / 1000;
  const maxEle = Math.round(Math.max(...eleRaw));
  const minEle = Math.round(Math.min(...eleRaw));
  const avgGrade = (ascent / dist) * 100;

  const speed = vehicle === "moto" ? 26 : 12; // km/h base
  const estMinutes = Math.round(
    (distanceKm / speed) * 60 + ascent / (vehicle === "moto" ? 12 : 8),
  );

  const techScore = (cfg.technical ? 2 : 0) + (avgGrade > 5 ? 2 : avgGrade > 3 ? 1 : 0);
  const difficulty =
    vehicle === "moto"
      ? ["Green lane", "Trail / Easy enduro", "Hard enduro", "Extreme enduro"][
          Math.min(3, techScore)
        ]
      : ["Blue — flowy", "Blue/Black", "Black — technical", "Double black"][
          Math.min(3, techScore)
        ];

  const placeLabel = cfg.place ?? "your location";
  const name = routeName(prompt, cfg, rnd, placeLabel);

  const highlights = buildHighlights(cfg, vehicle, maxEle, ascent, rnd);

  const description = [
    `A ${distanceKm.toFixed(1)} km loop starting and finishing near ${placeLabel}, drafted from your brief “${prompt.trim()}”.`,
    `The line climbs ${Math.round(ascent)} m in total, topping out at ${maxEle} m with an average gradient of ${avgGrade.toFixed(1)}%. Surface is predominantly ${cfg.surface.toLowerCase()}.`,
    cfg.climbFactor > 1.5
      ? "Expect a sustained main ascent in the first third — pace it, the descent pays you back."
      : "Climbing is broken into rolling sections, so the effort stays punchy rather than grinding.",
    vehicle === "moto"
      ? "Fuel range is comfortable for a single tank; connector sections use forest roads that stay rideable after rain."
      : "Water is the limiter here — carry at least 2 L, there are no reliable refills on the high section.",
  ].join(" ");

  return {
    id: `${hashString(prompt + Date.now()).toString(36)}`,
    name,
    prompt: prompt.trim(),
    vehicle,
    points,
    distanceKm,
    ascent: Math.round(ascent),
    descent: Math.round(descent),
    maxEle,
    minEle,
    avgGrade,
    estMinutes,
    difficulty,
    surface: cfg.surface,
    description,
    highlights,
    refs: buildRefs(prompt, cfg, vehicle, distanceKm, rnd, placeLabel),
  };
}

function routeName(
  prompt: string,
  cfg: ReturnType<typeof parsePrompt>,
  rnd: () => number,
  place: string,
) {
  const adj = cfg.technical
    ? ["Chunder", "Granite", "Ragged", "Boulder"]
    : cfg.flowy
      ? ["Velvet", "Ribbon", "Silk", "Glide"]
      : ["Ridge", "Cloud", "Pine", "Monsoon"];
  const noun = cfg.climbFactor > 1.5 ? ["Ascent", "Skyline", "Summit"] : ["Loop", "Circuit", "Traverse"];
  return `${adj[Math.floor(rnd() * adj.length)]!} ${noun[Math.floor(rnd() * noun.length)]!} — ${place}`;
}

function buildHighlights(
  cfg: ReturnType<typeof parsePrompt>,
  vehicle: Vehicle,
  maxEle: number,
  ascent: number,
  rnd: () => number,
) {
  const pool = [
    `Ridge viewpoint at ${maxEle} m with a full valley panorama`,
    `${Math.round(ascent * 0.6)} m of the climbing is packed into one sustained push`,
    cfg.technical
      ? "Two rock-garden sections with clean B-lines on the right"
      : "Long bermed descent that holds speed the whole way down",
    vehicle === "moto"
      ? "Water crossing at the midpoint — check depth after rain"
      : "Shaded bamboo section that stays cool through midday",
    "Village stop near two-thirds distance for food and water",
    "Exposed traverse — avoid in afternoon storm season",
  ];
  return pool.sort(() => rnd() - 0.5).slice(0, 4);
}

function buildRefs(
  prompt: string,
  cfg: ReturnType<typeof parsePrompt>,
  vehicle: Vehicle,
  distanceKm: number,
  rnd: () => number,
  place: string,
): TrailRef[] {
  const names = [
    "Upper Ridgeline",
    "Doi Backdoor",
    "Old Logging Cut",
    "Waterfall Descent",
    "Radio Tower Climb",
    "Bamboo Chute",
    "Quarry Traverse",
  ].sort(() => rnd() - 0.5);

  const diffs = cfg.technical
    ? ["Black Diamond", "Double Black", "Blue Square"]
    : ["Blue Square", "Green Circle", "Black Diamond"];

  const mk = (source: TrailRef["source"], i: number): TrailRef => ({
    source,
    name: names[i]!,
    difficulty: diffs[i % diffs.length]!,
    rating: Math.round((3.6 + rnd() * 1.4) * 10) / 10,
    length: Math.round(distanceKm * (0.12 + rnd() * 0.3) * 10) / 10,
    note:
      source === "Trailforks"
        ? "Recent ride reports: dry, fast, some fresh cut on the upper half."
        : "Community reviews mention navigation is tricky at the second junction.",
    url:
      source === "Trailforks"
        ? `https://www.trailforks.com/trails/?activitytype=${vehicle === "moto" ? 10 : 1}&q=${encodeURIComponent(place)}`
        : `https://www.alltrails.com/search?q=${encodeURIComponent(place + " " + prompt.slice(0, 30))}`,
  });

  return [mk("Trailforks", 0), mk("Trailforks", 1), mk("AllTrails", 2), mk("AllTrails", 3)];
}

/* ---------- GPX ---------- */

export function toGPX(route: GeneratedRoute) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const start = new Date();
  const pts = route.points
    .map((p, i) => {
      const time = new Date(start.getTime() + i * 20000).toISOString();
      return `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><ele>${p.ele}</ele><time>${time}</time></trkpt>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailMind AI" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${esc(route.name)}</name>
    <desc>${esc(route.description)}</desc>
    <time>${start.toISOString()}</time>
  </metadata>
  <trk>
    <name>${esc(route.name)}</name>
    <type>${route.vehicle === "moto" ? "motorcycling" : "mtb"}</type>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

export function downloadGPX(route: GeneratedRoute) {
  const blob = new Blob([toGPX(route)], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${route.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.gpx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
