import { createContext, useContext, createElement, type ReactNode } from "react";

export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

export interface PluralRule {
  /** Given a number, return the plural category */
  select: (n: number) => PluralCategory;
}

/** English: 1 = "one", everything else = "other" */
export const PLURAL_EN: PluralRule = {
  select: (n) => n === 1 ? "one" : "other",
};

/** Arabic: 0="zero", 1="one", 2="two", 3-10="few", 11-99="many", 100+="other" */
export const PLURAL_AR: PluralRule = {
  select: (n) => {
    if (n === 0) return "zero";
    if (n === 1) return "one";
    if (n === 2) return "two";
    const mod100 = n % 100;
    if (mod100 >= 3 && mod100 <= 10) return "few";
    if (mod100 >= 11 && mod100 <= 99) return "many";
    return "other";
  },
};

/** French/Portuguese: 0-1 = "one", 2+ = "other" */
export const PLURAL_FR: PluralRule = {
  select: (n) => n <= 1 ? "one" : "other",
};

/** Russian/Polish: complex Slavic plurals */
export const PLURAL_RU: PluralRule = {
  select: (n) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "one";
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "few";
    return "many";
  },
};

/** Japanese/Chinese/Korean: no plural forms */
export const PLURAL_JA: PluralRule = {
  select: () => "other",
};

export interface NumberFormat {
  /** Decimal separator, e.g. "." or "," */
  readonly decimal: string;
  /** Thousands separator, e.g. "," or "." */
  readonly thousands: string;
  /** Digits per group (typically 3) */
  readonly grouping: number;
}

export interface Locale {
  /** ISO 639-1 code, e.g. "en", "ja", "ar" */
  readonly code: string;
  /** Text direction */
  readonly direction: "ltr" | "rtl";
  /** Number formatting */
  readonly numbers: NumberFormat;
  /** Full month names (January..December) */
  readonly months: readonly string[];
  /** Short month names (Jan..Dec) */
  readonly monthsShort: readonly string[];
  /** Full weekday names (Sunday..Saturday) */
  readonly weekdays: readonly string[];
  /** Short weekday names (Sun..Sat) */
  readonly weekdaysShort: readonly string[];
  /** Translatable UI strings keyed by dot-path */
  readonly strings: Readonly<Record<string, string>>;
  /** Plural rule for this locale (defaults to English rules if omitted) */
  readonly pluralRule?: PluralRule;
}

export const EN: Locale = {
  code: "en",
  direction: "ltr",
  pluralRule: PLURAL_EN,
  numbers: { decimal: ".", thousands: ",", grouping: 3 },
  months: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  monthsShort: [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ],
  weekdays: [
    "Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday",
  ],
  weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  strings: {},
};

const locales = new Map<string, Locale>();
locales.set("en", EN);

/** Register a locale for later lookup by code. */
export function registerLocale(locale: Locale): void {
  locales.set(locale.code, locale);
}

/** Retrieve a registered locale by code. */
export function getLocale(code: string): Locale | undefined {
  return locales.get(code);
}

/** List all registered locale codes. */
export function getRegisteredLocales(): string[] {
  return Array.from(locales.keys());
}

/**
 * Format a number according to the locale's decimal/thousands conventions.
 *
 * @example
 * ```ts
 * formatNumber(1234567.89, EN); // "1,234,567.89"
 * ```
 */
export function formatNumber(n: number, locale: Locale): string {
  const { decimal, thousands, grouping } = locale.numbers;
  const [intPart, fracPart] = Math.abs(n).toFixed(20).split(".");
  // Trim trailing zeros from fracPart to get actual fractional digits
  const rawFrac = fracPart ? fracPart.replace(/0+$/, "") : "";
  const sign = n < 0 ? "-" : "";

  // Group the integer part
  let grouped = "";
  for (let i = intPart!.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % grouping === 0) {
      grouped = thousands + grouped;
    }
    grouped = intPart![i] + grouped;
  }

  return rawFrac.length > 0
    ? sign + grouped + decimal + rawFrac
    : sign + grouped;
}

/**
 * Translate a key with optional parameter interpolation.
 *
 * Parameters are replaced using `{name}` placeholders.
 * Falls back to the key itself if no translation is found.
 *
 * @example
 * ```ts
 * const locale = { ...EN, strings: { "greeting": "Hello, {name}!" } };
 * t("greeting", locale, { name: "World" }); // "Hello, World!"
 * t("missing.key", locale); // "missing.key"
 * ```
 */
export function t(
  key: string,
  locale: Locale,
  params?: Record<string, string | number>,
): string {
  let text = locale.strings[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.split(`{${k}}`).join(String(v));
    }
  }
  return text;
}

/**
 * Select the correct plural form for a number.
 *
 * Looks up `${key}.${category}` in the locale's strings (or provided
 * `strings` override), falling back to `${key}.other`, then to `${count}`.
 * Interpolates `{count}` with the number.
 *
 * @example
 * ```ts
 * const messages = {
 *   "items.one": "{count} item",
 *   "items.other": "{count} items",
 *   "items.zero": "No items",
 * };
 * plural("items", 0, EN, messages); // "No items"
 * plural("items", 1, EN, messages); // "1 item"
 * plural("items", 5, EN, messages); // "5 items"
 * ```
 */
export function plural(
  key: string,
  count: number,
  locale: Locale,
  strings?: Record<string, string>,
): string {
  const rule = locale.pluralRule ?? PLURAL_EN;
  const category = rule.select(count);
  const lookup = strings ?? locale.strings;

  const exactKey = `${key}.${category}`;
  const otherKey = `${key}.other`;

  let text: string | undefined = lookup[exactKey];
  if (text === undefined && category !== "other") {
    text = lookup[otherKey];
  }
  if (text === undefined) {
    return String(count);
  }

  return text.split("{count}").join(String(count));
}

export const LocaleContext = createContext<Locale>(EN);

/**
 * Provider component that sets the locale for the subtree.
 *
 * @example
 * ```tsx
 * <LocaleProvider locale={myLocale}>
 *   <App />
 * </LocaleProvider>
 * ```
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children?: ReactNode;
}) {
  return createElement(LocaleContext.Provider, { value: locale }, children);
}

/**
 * Read the current locale from context. Falls back to EN.
 * Prefer using this via the `useLocale` hook from `hooks/useLocale.js`.
 */
export function useLocaleContext(): Locale {
  return useContext(LocaleContext);
}
