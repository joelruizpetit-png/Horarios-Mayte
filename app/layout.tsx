import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Horarios Mayte",
  description: "Horarios y Agenda de Mayte",
  applicationName: "Horarios Mayte",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Horarios Mayte",
  },
  icons: {
    icon: [
      { url: "/placeholder.png", sizes: "192x192", type: "image/png" },
      { url: "/placeholder.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/placeholder.png",
    apple: [
      { url: "/placeholder.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#1d4ed8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" style={{ colorScheme: "light" }}>
      <head>
        <meta name="color-scheme" content="light" />
        <link rel="icon" href="/placeholder.png" type="image/png" />
        <link rel="shortcut icon" href="/placeholder.png" type="image/png" />
        <link rel="apple-touch-icon" href="/placeholder.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Horarios Mayte" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-gray-900`}
        style={{ colorScheme: "light", backgroundColor: "#ffffff", color: "#111827" }}
      >
        {children}
      </body>
    </html>
  );
}
