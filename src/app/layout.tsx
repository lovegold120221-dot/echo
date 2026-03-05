import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EchoLabs · Eburon AI",
  description: "Advanced Voice & Create AI Console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Animated Background Wave */}
        <div className="wave-container">
          <div className="wave"></div>
          <div className="wave2"></div>
        </div>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
