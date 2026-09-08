import type { Metadata, Viewport } from "next";
import { Fraunces, Karla } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { RegisterSW } from "@/components/pwa/register-sw";
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
const THEME_INIT_SCRIPT = `(function(){try{var raw=localStorage.getItem('fht-theme');if(!raw)return;var c=JSON.parse(raw);if(!c||!c.enabled||!c.colors)return;var col=c.colors;function lum(h){h=(h||'').replace('#','');if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];var r=parseInt(h.slice(0,2),16)/255,g=parseInt(h.slice(2,4),16)/255,b=parseInt(h.slice(4,6),16)/255;function f(v){return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);}function fg(h){return lum(h)>0.42?'#0c1a33':'#ffffff';}var p=col.primary,s=col.secondary,a=col.accent,t=col.tab;var v={'--primary':p,'--primary-foreground':fg(p),'--brand':p,'--brand-hover':p,'--sidebar-primary':p,'--sidebar-primary-foreground':fg(p),'--ring':s,'--sidebar-ring':s,'--brand-2':s,'--brand-2-hover':s,'--accent-brand':a,'--tab-active':t,'--tab-active-foreground':fg(t)};var r=document.documentElement;for(var k in v){r.style.setProperty(k,v[k]);}}catch(e){}})();`;

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
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    siteName: "Finance & Habit Tracker",
    type: "website",
    locale: "en_US",
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
  maximumScale: 1,
  viewportFit: "cover",
};

/**
 * The product ships in one theme: dark. Two things have to be true for that,
 * and only one of them is obvious.
 *
 * 1. `forcedTheme` (next-themes) makes the *class* dark no matter what. Its
 *    pre-paint script short-circuits on a forced theme before it ever reads
 *    localStorage, so a "light" value stored by the old toggle cannot win.
 *    Deleting the toggle without this would have been worse than useless: the
 *    provider used to default to "light", so every user without a stored
 *    preference — i.e. every new user — would have been stranded in a light
 *    theme with nothing left to switch it back.
 *
 * 2. `forcedTheme` alone still leaks. next-themes computes
 *    `resolvedTheme` from the *stored* value and ignores the forced one, so a
 *    user carrying "light" in storage would hand `resolvedTheme === "light"`
 *    to <Toaster/>, which forwards it to sonner. Sonner colours toast
 *    description text off that flag (`#3f3f3f` in light, near-white in dark),
 *    and our toasts sit on the dark `--popover`, so descriptions would render
 *    dark-grey on dark-navy — invisible. Moving to a fresh storage key retires
 *    every stale value at once, and `defaultTheme="dark"` means the key that
 *    replaces it reads back "dark".
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
            __html: `(function(){try{document.documentElement.dataset.privacy=localStorage.getItem('fht-privacy')==='1'?'hidden':'';localStorage.removeItem('theme');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {/* Still mounted, not removed: ui/sonner.tsx calls useTheme(), which
            falls back to an empty context with no provider — leaving sonner on
            its "light" default and the unreadable descriptions described
            above. See COLOR_MODE for why it is forced, not merely defaulted. */}
        <ThemeProvider
          attribute="class"
          forcedTheme={COLOR_MODE}
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
      </body>
    </html>
  );
}
