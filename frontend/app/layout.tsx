import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Outfit, Space_Grotesk } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { BG_THEME_COLOR } from "@/lib/palette";
import { getThemeInitScript } from "@/lib/theme";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lapwise - F1 Analytics & Telemetry",
  description:
    "Professional Formula 1 analytics platform with race results, telemetry data, and comprehensive driver statistics.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Lapwise",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: BG_THEME_COLOR.dark },
    { media: "(prefers-color-scheme: light)", color: BG_THEME_COLOR.light },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variables must sit on <html>: `--font-sans` is declared on :root
    // and resolves `var(--font-outfit, …)` there, so a variable defined only on
    // <body> arrives too late and every page falls back to Segoe UI.
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${outfit.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable}`}
    >
      <body className="antialiased">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: inline theme-init script must run before first paint to prevent a flash of the wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
