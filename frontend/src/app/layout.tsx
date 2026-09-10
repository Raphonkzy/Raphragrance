import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0D0D0B",
};

export const metadata: Metadata = {
  title: "Raphragrance - Fragrance Encyclopedia",
  description:
    "Explore 131,000+ fragrances with detailed notes, accords, performance data, and fragrance pyramids. Your personal fragrance reference, like Fragrantica but yours.",
  keywords: ["fragrance", "parfum", "perfume database", "fragrance notes", "niche perfume", "fragrance encyclopedia"],
  openGraph: {
    title: "Raphragrance - Fragrance Encyclopedia",
    description: "Explore fragrances with detailed notes, accords, and performance data.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
