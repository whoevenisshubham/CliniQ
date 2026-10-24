import type { Metadata } from "next";
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";
import "./globals.css";
import { ThemeProvider } from "@/components/shared/ThemeProvider";

export const metadata: Metadata = {
  title: "CLINIQ+ · Records for every visit",
  description:
    "Private health records and clinician-reviewed documentation. An educational synthetic-data product in development.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-source-sha={process.env.NEXT_PUBLIC_BUILD_SHA??'unavailable'} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
