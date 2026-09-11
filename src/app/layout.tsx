import type { Metadata, Viewport } from "next";
import { Fraunces, Karla } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { RegisterSW } from "@/components/pwa/register-sw";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ThemeCustomizerProvider } from "@/components/providers/theme-customizer";
import { getSiteURL } from "@/lib/site";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

/**
 * Public Supabase config, resolved on the server at runtime and injected into
 * the page. This makes the browser client independent of build-time
 * NEXT_PUBLIC_* inlining (which silently fails if the env var wasn't present at
 * build). The anon key is public by design — access is guarded by RLS.
 */
function supabaseRuntimeConfig() {
  try {
    return { url: supabaseUrl(), key: supabaseAnonKey() };
  } catch {
    return null;
  }
}

/**
 * Pre-paint script that applies the user's saved custom theme (from
 * localStorage) before first paint, so there's no flash of the default palette.
 * Mirrors themeVars()/readableForeground() in src/lib/theme.ts.
 */
const THEME_INIT_SCRIPT = `(function(){try{var raw=localStorage.getItem('fht-theme');if(!raw)return;var c=JSON.parse(raw);if(!c||!c.enabled||!c.colors)return;var col=c.colors;function lum(h){h=(h||'').replace('#','');if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];var r=parseInt(h.slice(0,2),16)/255,g=parseInt(h.slice(2,4),16)/255,b=parseInt(h.slice(4,6),16)/255;function f(v){return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);}function fg(h){return lum(h)>0.42?'#0c1a33':'#ffffff';}var p=col.primary,s=col.secondary,a=col.accent,t=col.tab;var v={'--primary':p,'--primary-foreground':fg(p),'--brand':p,'--brand-hover':p,'--sidebar-primary':p,'--sidebar-primary-foreground':fg(p),'--brand-foreground':fg(p),'--ring':s,'--sidebar-ring':s,'--brand-2':s,'--brand-2-hover':s,'--accent-brand':a,'--tab-active':t,'--tab-active-foreground':fg(t)};var r=document.documentElement;for(var k in v){r.style.setProperty(k,v[k]);}}catch(e){}})();`;

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

const karla = Karla({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteURL()),
  title: {
    default: "Finance & Habit Tracker",
    template: "%s · Finance & Habit Tracker",
  },
  description:
    "Track your money, habits, mood, tasks, and focus sessions — all in one calm place.",
  applicationName: "Finance & Habit Tracker",
  keywords: [
    "finance tracker",
    "habit tracker",
    "budget app",
    "cash flow",
    "focus timer",
  ],
  category: "finance",
  creator: "Kinggenzdigitals-OS",
  publisher: "Kinggenzdigitals-OS",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    siteName: "Finance & Habit Tracker",
    title: "Finance & Habit Tracker",
    description:
      "Track your money, habits, mood, tasks, and focus sessions in one calm workspace.",
    type: "website",
    locale: "en_US",
    url: getSiteURL(),
  },
  twitter: {
    card: "summary_large_image",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Finance & Habit Tracker",
  },
};

export const viewport: Viewport = {
  // The dark `--background`, matching manifest.ts. Browser/OS chrome is painted
  // from this before the document exists, so leaving it on the light brand navy
  // left the surround mismatched against a permanently dark app.
  themeColor: "#0b1220",
  width: "device-width",
  initialScale: 1,
  // No maximumScale: locking pinch-zoom fails WCAG 1.4.4 (Resize Text), and on
  // a screen full of small financial figures it is exactly the wrong thing to
  // take away. axe flagged it "critical" on every public page.
  viewportFit: "cover",
};

/**
 * Dark is the DEFAULT, and light is a real choice again — a sun/moon toggle
 * sits beside the brand. Two things this setup has to get right:
 *
 * 1. The <html> class is server-rendered as dark so the dark palette is live on
 *    the first byte for the common case. A user who chose light gets that
 *    class replaced by next-themes' pre-paint script a moment later; that
 *    brief dark-to-light flip is the price of not flashing light at everyone
 *    else, and the script runs before the parser reaches any content.
 *
 * 2. The storage key stays `fht-color-mode`, not "theme". The old toggle had
 *    written "light" under "theme" for some users; a fresh key means the only
 *    values ever stored under it come from THIS toggle, and `defaultTheme`
 *    fills in "dark" for everyone who has never pressed it. (`resolvedTheme`
 *    is computed from the stored value, and <Toaster/> colours sonner's
 *    description text from it, so a stale "light" here once rendered toast
 *    text dark-grey on a dark popover.)
 */
const COLOR_MODE = "dark";
/** Deliberately not "theme": the old key still holds users' stale "light". */
const COLOR_MODE_STORAGE_KEY = "fht-color-mode";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sb = supabaseRuntimeConfig();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      // Server-rendered so the dark palette is live on the very first byte.
      // next-themes injects its pre-paint script *inside* <body>, below the
      // provider, so without this class the document would paint with the
      // :root (light) tokens until the parser reached that script.
      className={cn(
        "h-full antialiased",
        COLOR_MODE,
        fraunces.variable,
        karla.variable,
      )}
      // Same reasoning for native UI (scrollbars, date pickers, autofill):
      // next-themes sets this too, just a beat later.
      style={{ colorScheme: COLOR_MODE }}
    >
      <head>
        {sb && (
          <script
            // Runtime Supabase config for the browser client (see helper above).
            dangerouslySetInnerHTML={{
              __html: `window.__SB__=${JSON.stringify(sb)};`,
            }}
          />
        )}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script
          dangerouslySetInnerHTML={{
            // The removeItem tags along in this already-present script rather
            // than a fourth <script> in the critical path: 'theme' is what the
            // deleted light/dark toggle wrote, nothing reads it since the
            // provider moved to COLOR_MODE_STORAGE_KEY, and leaving a stale
            // "light" behind invites a future reader to think it still counts.
            // It runs AFTER the masking assignment so it can never pre-empt it.
            // The sidebar-collapsed stamp rides along for the same reason a
            // pre-paint script exists at all: without it a collapsed rail
            // paints at full width and snaps shut after hydration.
            __html: `(function(){try{document.documentElement.dataset.privacy=localStorage.getItem('fht-privacy')==='1'?'hidden':'';if(localStorage.getItem('fht-sidebar')==='1')document.documentElement.dataset.sidebar='collapsed';localStorage.removeItem('theme');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {/* ui/sonner.tsx reads useTheme() to colour toasts, so the provider has
            to wrap the toaster as well as the app. See COLOR_MODE above for
            why dark is the default rather than the system preference. */}
        <ThemeProvider
          attribute="class"
          defaultTheme={COLOR_MODE}
          storageKey={COLOR_MODE_STORAGE_KEY}
          enableSystem={false}
          disableTransitionOnChange
        >
          <ThemeCustomizerProvider>
            {children}
            <Toaster />
          </ThemeCustomizerProvider>
        </ThemeProvider>
        <RegisterSW />
        <Analytics />
        {process.env.NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS === "true" && (
          <SpeedInsights />
        )}
      </body>
    </html>
  );
}
