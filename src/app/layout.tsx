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
  themeColor: "#012269",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

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
      className={cn("h-full antialiased", fraunces.variable, karla.variable)}
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
            __html: `(function(){try{document.documentElement.dataset.privacy=localStorage.getItem('fht-privacy')==='1'?'hidden':'';}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
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
