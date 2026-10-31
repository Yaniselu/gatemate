export interface MrzDocument {
  type: string;
  country: string;
  lastName: string;
  firstName: string;
  number: string;
  nationality: string;
  birth: string;
  sex: string;
  expiry: string;
  lines: string[];
}

export function findMrz(text: string | string[]): MrzDocument | null {
  const raw = (Array.isArray(text) ? text : text.split(/\r?\n/))
    .map((l) => normalise(l))
    .filter((l) => l.length >= 28 && /</.test(l));
  for (let i = 0; i + 1 < raw.length; i++) {
    const a = raw[i], b = raw[i + 1];
    if (a.length >= 42 && b.length >= 42) {
      const d = td3(fit(a, 44), fit(b, 44));
      if (d) return d;
    }
    if (i + 2 < raw.length && a.length >= 28 && b.length >= 28) {
      const d = td1(fit(a, 30), fit(b, 30), fit(raw[i + 2], 30));
      if (d) return d;
    }
    if (a.length >= 34 && b.length >= 34) {
      const d = td2(fit(a, 36), fit(b, 36));
      if (d) return d;
    }
  }
  return null;
}

function normalise(l: string): string {
  return l
    .toUpperCase()
    .replace(/[«‹＜]/g, '<')
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9<]/g, '');
}

function td3(l1: string, raw2: string): MrzDocument | null {
  if (l1[0] !== 'P') return null;
  const l2 = numeric(raw2, [[9, 10], [13, 20], [21, 28], [43, 44]]);
  const number = l2.slice(0, 9), birth = l2.slice(13, 19), expiry = l2.slice(21, 27);
  if (!ok(number, l2[9]) || !ok(birth, l2[19]) || !ok(expiry, l2[27])) return null;
  if (!ok(l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43), l2[43])) return null;
  return build('P', l1.slice(2, 5), names(l1.slice(5)), number, l2.slice(10, 13), birth, l2[20], expiry, [l1, l2]);
}

function td1(l1raw: string, raw2: string, l3: string): MrzDocument | null {
  if (!'IAC'.includes(l1raw[0])) return null;
  const l1 = numeric(l1raw, [[14, 15]]);
  const l2 = numeric(raw2, [[0, 7], [8, 15], [29, 30]]);
  const number = l1.slice(5, 14), birth = l2.slice(0, 6), expiry = l2.slice(8, 14);
  if (!ok(number, l1[14]) || !ok(birth, l2[6]) || !ok(expiry, l2[14])) return null;
  if (!ok(l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29), l2[29])) return null;
  return build('I', l1.slice(2, 5), names(l3), number, l2.slice(15, 18), birth, l2[7], expiry, [l1, l2, l3]);
}

function td2(l1: string, raw2: string): MrzDocument | null {
  if (!'IACP'.includes(l1[0])) return null;
  const l2 = numeric(raw2, [[9, 10], [13, 20], [21, 28], [35, 36]]);
  const number = l2.slice(0, 9), birth = l2.slice(13, 19), expiry = l2.slice(21, 27);
  if (!ok(number, l2[9]) || !ok(birth, l2[19]) || !ok(expiry, l2[27])) return null;
  if (!ok(l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 35), l2[35])) return null;
  return build(l1[0], l1.slice(2, 5), names(l1.slice(5)), number, l2.slice(10, 13), birth, l2[20], expiry, [l1, l2]);
}

function numeric(s: string, ranges: [number, number][]): string {
  const c = s.split('');
  for (const [a, b] of ranges) for (let i = a; i < b && i < c.length; i++) c[i] = ({ O: '0', D: '0', Q: '0', I: '1', L: '1', S: '5', B: '8', Z: '2', G: '6' } as Record<string, string>)[c[i]] ?? c[i];
  return c.join('');
}

function build(type: string, country: string, n: [string, string], number: string, nat: string, birth: string, sex: string, expiry: string, lines: string[]): MrzDocument | null {
  if (!n[0]) return null;
  return {
    type,
    country: country.replace(/</g, ''),
    lastName: n[0],
    firstName: n[1],
    number: number.replace(/</g, ''),
    nationality: nat.replace(/</g, ''),
    birth: date(birth, false),
    sex: sex === 'M' || sex === 'F' ? sex : 'X',
    expiry: date(expiry, true),
    lines,
  };
}

function names(field: string): [string, string] {
  const f = field.replace(/<+$/, '');
  const at = f.indexOf('<<');
  const last = at < 0 ? f : f.slice(0, at);
  const first = at < 0 ? '' : f.slice(at + 2);
  return [words(last), words(first)];
}

function words(s: string): string {
  return s
    .replace(/</g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => /^[A-Z]+$/.test(w))
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(' ');
}

function date(yymmdd: string, future: boolean): string {
  const yy = +yymmdd.slice(0, 2);
  const now = new Date().getFullYear() % 100;
  const year = future ? 2000 + yy : yy > now ? 1900 + yy : 2000 + yy;
  return `${year}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}

function fit(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + '<'.repeat(len - s.length);
}

export function checkDigit(s: string): number {
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const v = c === '<' ? 0 : c >= '0' && c <= '9' ? +c : c >= 'A' && c <= 'Z' ? c.charCodeAt(0) - 55 : -1000;
    sum += v * w[i % 3];
  }
  return ((sum % 10) + 10) % 10;
}

function ok(field: string, check: string | undefined): boolean {
  if (check === undefined) return false;
  const c = check === '<' ? 0 : /\d/.test(check) ? +check : NaN;
  return !isNaN(c) && checkDigit(field) === c;
}
