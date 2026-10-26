import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RegisterSW from "../components/RegisterSW";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Vercel provides this variable in production; localhost is used while developing.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "WeatherWise",
  description:
    "Real-time weather, 7-day forecast, rain radar and air quality for any city.",
  openGraph: {
    title: "WeatherWise",
    description:
      "Real-time weather, 7-day forecast, rain radar and air quality for any city.",
    siteName: "WeatherWise",
    type: "website",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "WeatherWise" }],
  },
  twitter: {
    card: "summary",
    title: "WeatherWise",
    description: "Real-time weather dashboard for any city.",
    images: ["/icon-512.png"],
  },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "WeatherWise", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#080a0f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
