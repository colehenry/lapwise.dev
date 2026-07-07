import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Outfit, Space_Grotesk } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { ThemeProvider } from "@/components/ThemeProvider";
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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body
        className={`antialiased ${outfit.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable}`}
      >
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: inline theme-init script must run before first paint to prevent a flash of the wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
