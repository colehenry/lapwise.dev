import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/Footer";
import Navigation from "@/components/Navigation";
import QueryProvider from "@/components/QueryProvider";

export const metadata: Metadata = {
  title: "Lapwise - F1 Analytics & Telemetry",
  description:
    "Professional Formula 1 analytics platform with race results, telemetry data, and comprehensive driver statistics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <QueryProvider>
          <Navigation />
          <main className="pt-16 min-h-screen">{children}</main>
          <Footer />
        </QueryProvider>
      </body>
    </html>
  );
}
