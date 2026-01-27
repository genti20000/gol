import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  display: "swap",
});

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
      <body className={`${outfit.className} antialiased min-h-screen bg-[#0B0D10] text-[#rgba(255,255,255,0.92)]`}>
        {children}

        {/* Floating WhatsApp Label */}
        <a
          href="https://wa.me/447444144414"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-[100] bg-[#4ADE80] hover:bg-[#22C55E] text-white px-6 py-3 rounded-full font-bold text-[10px] uppercase tracking-[0.2em] shadow-2xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 no-underline"
        >
          <i className="fa-brands fa-whatsapp text-lg"></i>
          Live Support
        </a>
      </body>
    </html>
  );
}