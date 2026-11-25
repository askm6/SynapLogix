/**
 * Lightweight, typed i18n: Spanish by default (RNF-03) and English. Keys are checked at compile time,
 * and `{name}` placeholders are replaced with the values passed to t().
 */
import { useCallback, useMemo } from 'react';
import { useUi, type Language } from '@/app/store';
import { es, type MessageKey } from './es';
import { en } from './en';

const dictionaries: Record<Language, Record<MessageKey, string>> = { es, en };
const locales: Record<Language, string> = { es: 'es-ES', en: 'en-GB' };

export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

export function translate(
  language: Language,
  key: MessageKey,
  values?: Record<string, string | number>,
): string {
  const text = dictionaries[language][key] ?? es[key] ?? key;
  return values ? text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`)) : text;
}

/** Number and date formatters for the current language. */
export function makeFormat(language: Language) {
  const locale = locales[language];
  const number = (digits = 0) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const n0 = number(0);
  const n1 = number(1);
  const eur = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const dateTime = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
  const date = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  // API date-times are naive local times: read them as UTC so no time zone shift is applied.
  const parse = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : `${iso.slice(0, 19)}Z`);
  return {
    locale,
    int: (x: number) => n0.format(x),
    dec: (x: number) => n1.format(x),
    km: (x: number) => `${n0.format(x)} km`,
    hours: (x: number) => `${n1.format(x)} h`,
    eur: (x: number) => eur.format(x),
    pct: (x: number) => pct.format(x),
    seconds: (x: number) => `${x < 1 ? number(2).format(x) : n1.format(x)} s`,
    dateTime: (iso: string) => dateTime.format(parse(iso)),
    date: (iso: string) => date.format(parse(iso)),
  };
}

export type Format = ReturnType<typeof makeFormat>;

export function useI18n(): { t: Translate; f: Format; language: Language } {
  const language = useUi((s) => s.language);
  const t = useCallback<Translate>((key, values) => translate(language, key, values), [language]);
  const f = useMemo(() => makeFormat(language), [language]);
  return { t, f, language };
}

export type { MessageKey };
