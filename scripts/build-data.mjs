import fs from 'node:fs';
import path from 'node:path';
import { countries, languages } from 'countries-list';
import { FACTS } from './travel-facts.mjs';

const dir = process.argv[2] ?? '.data';
const SRC = {
  'airports.csv': 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv',
  'mwgg.json': 'https://raw.githubusercontent.com/mwgg/Airports/master/airports.json',
};
fs.mkdirSync(dir, { recursive: true });
for (const [file, url] of Object.entries(SRC)) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) fs.writeFileSync(p, Buffer.from(await (await fetch(url)).arrayBuffer()));
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...data] = rows;
  return data.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const mw = JSON.parse(fs.readFileSync(path.join(dir, 'mwgg.json'), 'utf8'));
const byIcao = new Map(Object.values(mw).map((v) => [v.icao, v]));
const byIata = new Map(Object.values(mw).filter((v) => v.iata).map((v) => [v.iata, v]));
const tzPoints = Object.values(mw).filter((v) => v.tz);
const rank = { L: 0, M: 1, S: 2 };
const best = new Map();
for (const r of parseCsv(fs.readFileSync(path.join(dir, 'airports.csv'), 'utf8'))) {
  const iata = r.iata_code.trim();
  if (!/^[A-Z]{3}$/.test(iata) || ['closed', 'heliport', 'balloonport', 'seaplane_base'].includes(r.type)) continue;
  if (r.scheduled_service !== 'yes' && !['large_airport', 'medium_airport'].includes(r.type)) continue;
  const lat = +(+r.latitude_deg).toFixed(5), lon = +(+r.longitude_deg).toFixed(5);
  const icao = r.icao_code || r.gps_code || '';
  const ref = byIcao.get(icao) ?? byIata.get(iata);
  const tz = ref?.tz ?? tzPoints.reduce((a, b) => ((b.lat - lat) ** 2 + (b.lon - lon) ** 2 < (a.lat - lat) ** 2 + (a.lon - lon) ** 2 ? b : a)).tz;
  const size = r.type === 'large_airport' ? 'L' : r.type === 'medium_airport' ? 'M' : 'S';
  const row = [iata, icao, r.name, ref?.city || r.municipality, r.iso_country, lat, lon, tz, size];
  if (!best.has(iata) || rank[size] < rank[best.get(iata)[8]]) best.set(iata, row);
}
const airports = [...best.values()].sort((a, b) => rank[a[8]] - rank[b[8]] || a[0].localeCompare(b[0]));
fs.writeFileSync('public/data/airports.json', JSON.stringify({ fields: ['iata', 'icao', 'name', 'city', 'country', 'lat', 'lon', 'tz', 'size'], airports }));

const out = {};
for (const [code, c] of Object.entries(countries)) {
  out[code] = {
    name: c.name,
    native: c.native,
    capital: c.capital,
    continent: c.continent,
    currency: c.currency,
    phone: c.phone,
    languages: c.languages.map((l) => languages[l]?.name ?? l),
    ...(FACTS[code] ?? {}),
  };
}
fs.writeFileSync('public/data/countries.json', JSON.stringify(out));
console.log(`airports: ${airports.length}, countries: ${Object.keys(out).length}`);
