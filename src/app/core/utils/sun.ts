export function sunTimes(date: Date, lat: number, lon: number): { sunrise: Date | null; sunset: Date | null; polar?: 'day' | 'night' } {
  const rad = Math.PI / 180;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86_400_000);
  const gamma = ((2 * Math.PI) / 365) * (day - 1);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const cosHa = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
  if (cosHa > 1) return { sunrise: null, sunset: null, polar: 'night' };
  if (cosHa < -1) return { sunrise: null, sunset: null, polar: 'day' };
  const ha = Math.acos(cosHa) / rad;
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const rise = 720 - 4 * (lon + ha) - eqTime;
  const set = 720 - 4 * (lon - ha) - eqTime;
  return { sunrise: new Date(midnight + rise * 60_000), sunset: new Date(midnight + set * 60_000) };
}
