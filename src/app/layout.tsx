import type { Metadata, Viewport } from "next";
import { Fraunces, Karla } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { RegisterSW } from "@/components/pwa/register-sw";
import { ThemeProvider } from "@/components/providers/theme-provider";
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
    default: "Life OS",
    template: "%s · Life OS",
  },
  description:
    "Your personal life operating system — money, habits, mood, tasks, and calendar in one calm place.",
  applicationName: "Life OS",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    siteName: "Life OS",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Life OS",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF6F1",
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
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
