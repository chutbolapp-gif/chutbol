// Language setup that does not touch React Native (so it also runs in vitest).
import i18next, { type Module, type TFunction } from 'i18next';
import type { OvrStyle, RatePart } from '@chutbol/shared';
import { he } from './he';
import { en } from './en';

export const LANGS = ['he', 'en'] as const;
export type Lang = (typeof LANGS)[number];
/** Hebrew first: used when nothing was chosen yet. */
export const DEFAULT_LANG: Lang = 'he';

export const isLang = (x: unknown): x is Lang => LANGS.includes(x as Lang);
export const isRtlLang = (lang: Lang) => lang === 'he';
export const otherLang = (lang: Lang): Lang => (lang === 'he' ? 'en' : 'he');

export const resources = { he: { translation: he }, en: { translation: en } } as const;

/** A ready i18next instance for `lang`. The app passes initReactI18next as a plugin. */
export function createI18n(lang: Lang, plugins: Module[] = []) {
  const inst = i18next.createInstance();
  plugins.forEach(p => inst.use(p));
  void inst.init({
    resources,
    lng: lang,
    fallbackLng: DEFAULT_LANG,
    initAsync: false,
    // React Native renders plain text, so no HTML escaping
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return inst;
}

/** Text of one rating breakdown line (scoring returns keys + params, never text). */
export const partLabel = (t: TFunction, x: RatePart): string => t(`ratePart.${x.key}`, { ...x.params });

/** Value of a breakdown line, formatted like the prototype's rateWhy ("+0.5", base without "+"). */
export const partValue = (x: RatePart): string =>
  `${x.v > 0 && x.key !== 'base' ? '+' : ''}${Number.isInteger(x.v) ? x.v : x.v.toFixed(1)}`;

export const styleLabel = (t: TFunction, s: OvrStyle): string => t(`ovrStyle.${s}`);
