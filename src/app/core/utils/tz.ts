/** Offset of `tz` from UTC at instant `at`, in minutes (e.g. Europe/Bucharest in winter → 120). */
export function tzOffsetMinutes(tz: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(at));
  const v = (t: string) => +(parts.find((p) => p.type === t)?.value ?? 0);
  return Math.round((Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second')) - Math.floor(at / 1000) * 1000) / 60_000);
}

/** Interprets a wall-clock time ("2026-11-01T06:10") in the given IANA zone and returns the UTC instant. */
export function zonedToUtc(local: string, tz: string): Date {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return new Date(NaN);
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let guess = wall;
  for (let i = 0; i < 3; i++) guess = wall - tzOffsetMinutes(tz, guess) * 60_000;
  return new Date(guess);
}
