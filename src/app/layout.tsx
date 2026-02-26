import type { Metadata } from "next";
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
  title: "NexusMD — Smart EMR & Diagnostic Assistant",
  description:
    "AI-powered ambient clinical documentation for Indian healthcare. Voice-first EMR with real-time ICD mapping, safety guards, and ABDM compliance.",
  keywords: ["EMR", "medical", "healthcare", "AI", "India", "ABDM", "ICD-10"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[var(--background)] text-[var(--foreground)]`}
      >
        {children}
      </body>
    </html>
  );
}
