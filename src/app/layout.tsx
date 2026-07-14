import type { Metadata, Viewport } from "next";
import { Share_Tech_Mono } from "next/font/google";
import "./globals.css";

const ledFont = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-led",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Newton Highlands · Green Line D",
  description:
    "MBTA Green Line D LED arrival board for Newton Highlands — live SSE predictions for wall-mounted kiosk displays.",
  applicationName: "GreenLight Arrival Board",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Green Line D",
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
      <body className={`${ledFont.variable} h-full bg-black antialiased`}>
        {children}
      </body>
    </html>
  );
}
