/** Calendar-day difference between two dates (floor). */
export function daysBetween(from: Date, to: Date): number {
  const ms = stripTime(to).getTime() - stripTime(from).getTime();
  return Math.floor(ms / 86_400_000);
}

export function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 3_600_000);
}

/** Locale-independent display like "12 Aug 2026". */
export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

/** Maps an ISO date to a BCP-47 tag for toLocaleDateString. */
export function localeTag(locale: string): string {
  switch (locale) {
    case "hi":
      return "hi-IN";
    case "te":
      return "te-IN";
    default:
      return "en-IN";
  }
}
