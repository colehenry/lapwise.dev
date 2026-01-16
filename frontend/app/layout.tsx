import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import QueryProvider from "@/components/QueryProvider";

export const metadata: Metadata = {
  title: "lapwise.dev",
  description: "Chasing purple sectors.",
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
          <main className="pt-16">{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
