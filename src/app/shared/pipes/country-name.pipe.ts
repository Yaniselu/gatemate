import { Pipe, PipeTransform } from '@angular/core';
import { locale } from '../../core/i18n/i18n.service';

let byEnglish: Map<string, string> | null = null;

function codeFor(name: string): string | undefined {
  if (/^[A-Z]{2}$/.test(name)) return name;
  if (!byEnglish) {
    byEnglish = new Map();
    try {
      const en = new Intl.DisplayNames(['en'], { type: 'region' });
      for (let a = 65; a <= 90; a++) {
        for (let b = 65; b <= 90; b++) {
          const code = String.fromCharCode(a, b);
          const n = en.of(code);
          if (n && n !== code) byEnglish.set(n.toLowerCase(), code);
        }
      }
    } catch {
      return undefined;
    }
  }
  return byEnglish.get(name.trim().toLowerCase());
}

export function localCountryName(name: string | null | undefined): string {
  if (!name) return '';
  const lang = locale();
  if (lang.startsWith('en')) return name;
  const code = codeFor(name);
  if (!code) return name;
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? name;
  } catch {
    return name;
  }
}

@Pipe({ name: 'countryName' })
export class CountryNamePipe implements PipeTransform {
  transform(name: string | null | undefined): string {
    return localCountryName(name);
  }
}
