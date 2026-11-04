import type { Locale } from "@/lib/types";
import { en, type Dictionary } from "./en";
import { hi } from "./hi";
import { te } from "./te";

export type { Dictionary };

export const DICTIONARIES: Record<Locale, Dictionary> = { en, hi, te };

export const LOCALE_META: Array<{
  locale: Locale;
  nativeName: string;
  htmlLang: string;
}> = [
  { locale: "en", nativeName: "English", htmlLang: "en" },
  { locale: "hi", nativeName: "हिन्दी", htmlLang: "hi" },
  { locale: "te", nativeName: "తెలుగు", htmlLang: "te" }
];

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? en;
}

/**
 * Replaces `{token}` placeholders in a dictionary string.
 * Example: formatMessage("{n} days ago", { n: "12" })
 */
export function formatMessage(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match
  );
}

/** Resolves a dotted key like "guidance.nch_body" against a dictionary. */
export function lookupMessage(
  dict: Dictionary,
  dottedKey: string
): string | undefined {
  let cur: unknown = dict;
  for (const part of dottedKey.split(".")) {
    if (
      cur !== null &&
      typeof cur === "object" &&
      part in (cur as Record<string, unknown>)
    ) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

/** Flattens a nested dictionary into dot-separated keys (for completeness tests). */
export function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") {
    return prefix ? [prefix] : [];
  }
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    keys.push(...flattenKeys(value, path));
  }
  return keys;
}
