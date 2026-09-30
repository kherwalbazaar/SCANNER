import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";

import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "SCANNER",
  title: {
    default: "SCANNER",
    template: "%s · SCANNER",
  },
  description:
    "Jatra ticket gate scanner — verify QR tickets and record audience entries for Jatra events. Fast, reliable ticket scanning for event organizers.",
  keywords: ["scanner", "jatra", "ticket", "gate", "qr", "entry", "event", "bazaar"],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple.icon.png", sizes: "512x512", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SCANNER",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    type: "website",
    siteName: "SCANNER",
    title: "SCANNER",
    description: "Jatra ticket gate scanner — verify QR tickets and record audience entries.",
  },
  twitter: {
    card: "summary",
    title: "SCANNER",
    description: "Jatra ticket gate scanner — verify QR tickets and record audience entries.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#1e1b4b",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-touch-fullscreen" content="yes" />
        <meta name="msapplication-TileColor" content="#1e1b4b" />
        <meta name="msapplication-TileImage" content="/icon-192.png" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
