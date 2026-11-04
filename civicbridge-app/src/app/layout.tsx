import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Noto_Sans, Noto_Sans_Devanagari, Noto_Sans_Telugu } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/providers/app-provider";
import { PrototypeBanner } from "@/components/prototype-banner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const notoLatin = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-noto-latin",
  display: "swap"
});
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-devanagari",
  display: "swap"
});
const notoTelugu = Noto_Sans_Telugu({
  subsets: ["telugu"],
  variable: "--font-noto-telugu",
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "Civic Sathi — Your voice, a way forward",
    template: "%s — Civic Sathi"
  },
  description:
    "Independent hackathon prototype: identify, prepare, track, and escalate citizen grievances across consumer, EPFO, and railway routes. Synthetic data only.",
  robots: { index: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${notoLatin.variable} ${notoDevanagari.variable} ${notoTelugu.variable} min-h-[100dvh] antialiased`}
      >
        <AppProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-4 focus:py-2 focus:rounded-control focus:border focus:border-line">
            Skip to main content
          </a>
          <div className="portal-shell">
            <aside className="portal-sidebar" aria-label="Civic Sathi navigation">
              <Link className="portal-logo" href="/"><span>ॐ</span><strong>Civic Sathi<small>Project Om Saty</small></strong></Link>
              <p className="portal-sidebar-label">YOUR SPACE</p>
              <nav><Link href="/dashboard">▦ <span>My dashboard</span></Link><Link href="/">✳ <span>Start a grievance</span></Link><Link href="/dashboard">▤ <span>Cases and tracking</span></Link></nav>
              <div className="portal-sidebar-bottom"><span>Independent civic prototype</span><p>Guidance in your language. You stay in control.</p></div>
            </aside>
            <div className="portal-content">
              <SiteHeader />
              <PrototypeBanner />
              <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 md:px-6">{children}</main>
              <SiteFooter />
            </div>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
