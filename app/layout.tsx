import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  weight: "variable",
  axes: ["opsz"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
  weight: ["400", "500", "600"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // no maximum-scale — required by R-39
};

export const metadata: Metadata = {
  title: { default: "Raphragrance", template: "%s · Raphragrance" },
  description:
    "Fragrance encyclopedia. 131,930 perfumes with note pyramids, accord analysis, longevity, sillage, and seasonal data.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${plusJakartaSans.variable}`}
    >
      <head>
        {/* Preconnect to image CDN for faster LCP */}
        <link rel="preconnect" href="https://fimgs.net" />
        {/*
          Inline theme script — runs before first paint, prevents flash of wrong theme.
          Reads localStorage, falls back to prefers-color-scheme.
          No external dependencies, minimal byte count.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('rph-theme');if(s==='light'||s==='dark'){document.documentElement.setAttribute('data-theme',s);return;}if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}else{document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
