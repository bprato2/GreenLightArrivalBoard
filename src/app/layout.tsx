import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

const ledFont = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-led",
  display: "swap",
});

const stationFont = Barlow_Condensed({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-station",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GreenLight Arrival Board · MBTA",
  description:
    "MBTA LED arrival board and trip planner — subway, Commuter Rail, bus, and ferry live data plus schedule search.",
  applicationName: "GreenLight Arrival Board",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MBTA Board",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-black">
      <body className={`${ledFont.variable} ${stationFont.variable} h-full bg-black antialiased`}>
        {children}
      </body>
    </html>
  );
}
