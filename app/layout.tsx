import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const gilroy = localFont({
  src: [
    {
      path: "../assets/fonts/Gilroy-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/Gilroy-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      // Temporarily map weight 600 (SemiBold) to Gilroy-Bold.woff2
      // Swapping to Gilroy-SemiBold.woff2 will be a 1-line change here
      path: "../assets/fonts/Gilroy-Bold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../assets/fonts/Gilroy-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-gilroy",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Raphragrance — Fragrance Archive",
  description: "An independent fragrance archive and database.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={gilroy.variable} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fimgs.net" />
        <link rel="dns-prefetch" href="https://fimgs.net" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('rph-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();window.addEventListener('error',function(e){if(e.target&&e.target.tagName==='IMG')e.target.style.display='none';},true);`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
