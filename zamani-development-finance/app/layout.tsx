import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/* Loaded through next/font rather than a CSS @import.
 *
 * The three @import url(fonts.googleapis.com) lines this replaces were
 * render-blocking - the browser had to fetch globals.css, parse it, then make
 * a second round-trip to Google before any text could paint, which is what
 * produced the flash of unstyled text on every cold load. next/font
 * self-hosts the files at build time (no third-party request at all) and
 * emits a `size-adjust` fallback so the swap doesn't shift layout.
 *
 * Two families now, not three. Inter and Plus Jakarta Sans were both humanist
 * sans faces doing the same job at different weights, which is a pairing
 * without a contrast axis - Plus Jakarta was carrying only the `.font-display`
 * headings and cost a whole extra download to do it. Inter covers headings,
 * labels, body and data (the product-UI norm), and JetBrains Mono stays for
 * figures and timestamps, where monospace is a real functional distinction
 * rather than a decorative second voice. */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Zamani Development Finance | Enterprise Intelligence",
  description: "Decision intelligence platform for ZDF leadership",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable} ${jetbrainsMono.variable}`}>
      {/* suppressHydrationWarning here only: browser extensions (Grammarly,
          password managers, etc.) inject attributes like
          data-gr-ext-installed onto <body> after load, which React then
          flags as a mismatch even though the app never rendered them. This
          doesn't suppress warnings on any child - only real bugs deeper in
          the tree would still be caught. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
