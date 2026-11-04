"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bridge } from "@phosphor-icons/react";
import { useApp } from "@/components/providers/app-provider";
import { LOCALE_META } from "@/lib/i18n";

export function SiteHeader() {
  const pathname = usePathname();
  const { dict, locale, setLocale, store } = useApp();

  const navItems = [
    { href: "/", label: dict.nav.home },
    { href: "/dashboard", label: dict.nav.dashboard }
  ];

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-control text-lg font-bold tracking-tight"
        >
          <Bridge aria-hidden className="size-6 text-accent" weight="duotone" />
          <span>Civic Sathi</span>
          <span className="sr-only"> - {dict.app.tagline}</span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-1">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-control px-3 py-2 text-sm font-medium min-h-11 inline-flex items-center ${
                  active
                    ? "bg-accent-soft text-accent-strong"
                    : "text-ink-secondary hover:bg-sunken hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label={dict.lang.label}
            className="hidden rounded-control border border-line p-0.5 sm:flex"
          >
            {LOCALE_META.map((meta) => (
              <button
                key={meta.locale}
                type="button"
                onClick={() => setLocale(meta.locale)}
                aria-pressed={locale === meta.locale}
                className={`min-h-9 rounded-[6px] px-2.5 text-sm font-medium ${
                  locale === meta.locale
                    ? "bg-accent text-onaccent"
                    : "text-ink-secondary hover:bg-sunken hover:text-ink"
                }`}
              >
                {meta.nativeName}
              </button>
            ))}
          </div>
          <select
            aria-label={dict.lang.label}
            value={locale}
            onChange={(e) => setLocale(e.target.value as typeof locale)}
            className="sm:hidden min-h-11 rounded-control border border-line bg-surface px-2 text-sm"
          >
            {LOCALE_META.map((meta) => (
              <option key={meta.locale} value={meta.locale}>
                {meta.nativeName}
              </option>
            ))}
          </select>
          <span className="hidden text-xs text-ink-secondary lg:inline">
            {store ? `${dict.demo.activeAs.replace("{name}", store.profile.displayName)}` : ""}
          </span>
        </div>
      </div>
    </header>
  );
}
