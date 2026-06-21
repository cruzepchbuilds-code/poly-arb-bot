// Airport coordinates and city configuration for weather markets.
// Uses airport ASOS station coords instead of city center — the official
// NOAA/METAR readings that Polymarket uses for resolution come from airport
// sensors, and the 3–8°F difference matters for bucket-level precision.

export const CITIES = [
  // ── Secondary markets — wider spreads, repricing windows hours not minutes ──
  { id: "buenos-aires", name: "Buenos Aires", lat: -34.8222, lon: -58.5358, unit: "C",
    aliases: ["buenos aires", "buenosaires", "buenos_aires", "ezeiza", "eze"] },
  { id: "cape-town",    name: "Cape Town",    lat: -33.9715, lon:  18.6021, unit: "C",
    aliases: ["cape town", "capetown", "cape_town", "cpt"] },
  { id: "atlanta",      name: "Atlanta",      lat:  33.6407, lon: -84.4277, unit: "F",
    aliases: ["atlanta", "atl"] },
  { id: "dallas",       name: "Dallas",       lat:  32.8471, lon: -96.8518, unit: "F",
    aliases: ["dallas", "dal", "dfw", "fort worth"] },
  { id: "seoul",        name: "Seoul",        lat:  37.4602, lon: 126.4407, unit: "C",
    aliases: ["seoul", "incheon", "icn"] },
  // ── Primary markets — high volume, 5–15 min repricing windows ──────────────
  { id: "new-york",     name: "New York",     lat:  40.6413, lon: -73.7781, unit: "F",
    aliases: ["new york", "new york city", "nyc", "jfk", "manhattan", "central park"] },
  { id: "london",       name: "London",       lat:  51.4700, lon:  -0.4543, unit: "C",
    aliases: ["london", "lhr", "heathrow"] },
  { id: "tokyo",        name: "Tokyo",        lat:  35.5494, lon: 139.7798, unit: "C",
    aliases: ["tokyo", "haneda", "hnd", "narita"] },
  { id: "chicago",      name: "Chicago",      lat:  41.9742, lon: -87.9073, unit: "F",
    aliases: ["chicago", "ord", "o'hare"] },
  { id: "miami",        name: "Miami",        lat:  25.7959, lon: -80.2870, unit: "F",
    aliases: ["miami", "mia"] },
  { id: "los-angeles",  name: "Los Angeles",  lat:  33.9425, lon:-118.4081, unit: "F",
    aliases: ["los angeles", "la", "lax"] },
  { id: "sydney",       name: "Sydney",       lat: -33.9461, lon: 151.1772, unit: "C",
    aliases: ["sydney", "syd", "kingsford smith"] },
  { id: "dubai",        name: "Dubai",        lat:  25.2532, lon:  55.3657, unit: "C",
    aliases: ["dubai", "dxb"] },
  { id: "singapore",    name: "Singapore",    lat:   1.3644, lon: 103.9915, unit: "C",
    aliases: ["singapore", "sin", "changi"] },
  { id: "paris",        name: "Paris",        lat:  49.0097, lon:   2.5479, unit: "C",
    aliases: ["paris", "cdg", "charles de gaulle", "orly"] },
  { id: "toronto",      name: "Toronto",      lat:  43.6777, lon: -79.6248, unit: "C",
    aliases: ["toronto", "yyz", "pearson"] },
  { id: "berlin",       name: "Berlin",       lat:  52.3667, lon:  13.5033, unit: "C",
    aliases: ["berlin", "ber", "tegel", "schonefeld"] },
];

// Secondary cities first — higher expected edge in 2026 due to lower bot saturation
export const CITY_PRIORITY = [
  "buenos-aires", "cape-town", "atlanta", "dallas", "seoul",
  "toronto", "berlin", "chicago", "miami",
  "new-york", "london", "tokyo", "los-angeles", "sydney", "dubai", "singapore", "paris",
];

export function detectCity(text) {
  const q = String(text || "").toLowerCase();
  for (const id of CITY_PRIORITY) {
    const city = CITIES.find((c) => c.id === id);
    if (city && city.aliases.some((a) => q.includes(a))) return city;
  }
  return null;
}

export function getCityById(id) {
  return CITIES.find((c) => c.id === id) ?? null;
}
