import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
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
