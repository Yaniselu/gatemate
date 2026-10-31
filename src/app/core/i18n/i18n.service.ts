import { Injectable, Pipe, PipeTransform, isDevMode, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export type Lang = 'en' | 'ro' | 'es' | 'fr' | 'de' | 'it';

export const LANGUAGES: { code: Lang; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ro', name: 'Română', flag: '🇷🇴' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
];

const LOCALES: Record<Lang, string> = { en: 'en-GB', ro: 'ro-RO', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT' };
const KEY = 'gm_lang';

let dict: Record<string, string> = {};
let current: Lang = 'en';

export function t(text: string, params?: Record<string, string | number | null | undefined>): string {
  let s = dict[text];
  if (s === undefined) {
    s = text;
    if (current !== 'en' && isDevMode()) ((globalThis as { __gmI18nMissing?: Set<string> }).__gmI18nMissing ??= new Set()).add(text);
  }
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, v == null ? '' : String(v));
  return s;
}

export function currentLang(): Lang {
  return current;
}

export function locale(): string {
  return LOCALES[current];
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>('en');

  async init(): Promise<void> {
    let saved: string | null = null;
    try {
      saved = (await Preferences.get({ key: KEY })).value;
    } catch {
      saved = null;
    }
    const device = (navigator.language || 'en').slice(0, 2).toLowerCase();
    const pick = (saved ?? device) as Lang;
    await this.load(LOCALES[pick] ? pick : 'en');
  }

  async use(lang: Lang): Promise<void> {
    await Preferences.set({ key: KEY, value: lang }).catch(() => {});
    location.reload();
  }

  private async load(lang: Lang): Promise<void> {
    if (lang !== 'en') {
      try {
        dict = await (await fetch(`i18n/${lang}.json`)).json();
      } catch {
        dict = {};
        lang = 'en';
      }
    }
    current = lang;
    this.lang.set(lang);
    document.documentElement.lang = lang;
  }
}

@Pipe({ name: 't' })
export class TranslatePipe implements PipeTransform {
  transform(text: string | null | undefined, params?: Record<string, string | number | null | undefined>): string {
    return text ? t(text, params) : '';
  }
}

