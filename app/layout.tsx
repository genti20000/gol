import type { Metadata } from "next";
import Script from "next/script";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "London Karaoke Club | Premium Booking",
  description: "A premium karaoke room booking platform.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0B0D10" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LKC Admin" />
        <link rel="apple-touch-icon" href="/premium-hero.png" />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
        <Script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer />
      </head>
      <body className="antialiased min-h-screen bg-[#0B0D10] text-[rgba(255,255,255,0.92)]">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
