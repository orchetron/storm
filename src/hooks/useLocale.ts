/**
 * useLocale — hook providing the current Locale from context.
 *
 * Falls back to the built-in English locale (EN) when no
 * LocaleProvider is present in the tree.
 */

import { useLocaleContext, type Locale } from "../core/i18n.js";

/**
 * Returns the current {@link Locale} from the nearest `<LocaleProvider>`.
 *
 * @example
 * ```tsx
 * function Greeting() {
 *   const locale = useLocale();
 *   return <Text>{t("hello", locale)}</Text>;
 * }
 * ```
 */
export function useLocale(): Locale {
  return useLocaleContext();
}
