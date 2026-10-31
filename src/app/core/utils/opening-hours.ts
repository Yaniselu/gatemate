export interface OpenState {
  open: boolean;
  label: string;
}

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function openState(spec: string | undefined, timeZone: string, now = Date.now()): OpenState | null {
  if (!spec) return null;
  const s = spec.trim();
  if (/^24\/7$/.test(s)) return { open: true, label: 'Open 24 hours' };

  const local = localParts(now, timeZone);
  if (!local) return null;
  const today = local.day, minute = local.minute;
  const week: ([number, number][] | null)[] = Array(7).fill(null);
  for (const rule of s.split(';').map((x) => x.trim()).filter(Boolean)) {
    const m = rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?)+)?\s*(.*)$/);
    if (!m) return null;
    const days = m[1] ? expandDays(m[1]) : [0, 1, 2, 3, 4, 5, 6];
    if (!days) return null;
    const times = m[2].trim();
    if (/^(off|closed)$/i.test(times)) {
      for (const d of days) week[d] = [];
      continue;
    }
    if (/^24\/7$|^00:00-24:00$/.test(times)) {
      for (const d of days) week[d] = [[0, 1440]];
      continue;
    }
    const ranges: [number, number][] = [];
    for (const part of times.split(',').map((x) => x.trim())) {
      const t = part.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\+?$/);
      if (!t) return null;
      ranges.push([+t[1] * 60 + +t[2], +t[3] * 60 + +t[4]]);
    }
    for (const d of days) week[d] = ranges;
  }

  const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const todayRanges = week[today] ?? [];
  if (todayRanges.length === 1 && todayRanges[0][0] === 0 && todayRanges[0][1] >= 1440) return { open: true, label: 'Open 24 hours' };
  const yesterday = week[(today + 6) % 7] ?? [];
  for (const [a, b] of yesterday) if (b < a && minute < b) return { open: true, label: `Closes ${fmt(b)}` };
  for (const [a, b] of todayRanges) {
    const end = b <= a ? b + 1440 : b;
    if (minute >= a && minute < end) return { open: true, label: `Closes ${fmt(end)}` };
  }
  const next = todayRanges.map(([a]) => a).filter((a) => a > minute).sort((x, y) => x - y)[0];
  if (next !== undefined) return { open: false, label: `Opens ${fmt(next)}` };
  const tomorrow = week[(today + 1) % 7];
  if (tomorrow?.length) return { open: false, label: `Opens tomorrow ${fmt(tomorrow[0][0])}` };
  return { open: false, label: 'Closed today' };
}

function expandDays(spec: string): number[] | null {
  const out = new Set<number>();
  for (const part of spec.split(',').filter(Boolean)) {
    const [a, b] = part.split('-');
    const i = DAYS.indexOf(a), j = b ? DAYS.indexOf(b) : i;
    if (i < 0 || j < 0) return null;
    for (let k = i; ; k = (k + 1) % 7) {
      out.add(k);
      if (k === j) break;
    }
  }
  return [...out];
}

function localParts(now: number, timeZone: string): { day: number; minute: number } | null {
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
    const wd = p.find((x) => x.type === 'weekday')?.value ?? '';
    const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(wd);
    const minute = Number(p.find((x) => x.type === 'hour')?.value) * 60 + Number(p.find((x) => x.type === 'minute')?.value);
    return day < 0 || Number.isNaN(minute) ? null : { day, minute };
  } catch {
    return null;
  }
}
