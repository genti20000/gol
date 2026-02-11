import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "London Karaoke Club | Premium Booking",
  description: "A premium karaoke room booking platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body className="antialiased min-h-screen bg-[#0B0D10] text-[rgba(255,255,255,0.92)]">
        {children}

      </body>
    </html>
  );
}
