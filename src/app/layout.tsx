import type { Metadata } from "next";

import { Toaster } from "sonner";

import { Providers } from "@/components/providers";
import { THEME_PRE_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "forenix-oss — OSINT × Forensics",
  description:
    "Open-source platform that fuses OSINT investigations with forensic case management — one workflow from public-source lead to chain-of-custody evidence.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-accent="amber"
      data-density="standard"
      suppressHydrationWarning
    >
      <head>
        {/* Sets data-theme/accent/density from localStorage before paint so
            the page never flashes the wrong palette. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_PRE_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Toaster position="bottom-right" richColors theme="system" />
      </body>
    </html>
  );
}
