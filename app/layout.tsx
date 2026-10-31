import type { Metadata, Viewport } from "next";
import { Instrument_Serif, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--fd",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fm",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fb",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: { default: "Raphragrance", template: "%s · Raphragrance" },
  description: "Fragrance encyclopedia. 131,930 perfumes with accord analysis, note pyramids, season radar, and performance gauges.",
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
      className={`${instrumentSerif.variable} ${ibmPlexMono.variable} ${ibmPlexSans.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://fimgs.net" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var s=localStorage.getItem('rph-theme');
                if(s==='light'||s==='dark'){document.documentElement.setAttribute('data-theme',s);}
                else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}
                else{document.documentElement.setAttribute('data-theme','light');}
              } catch(e){}
              window.addEventListener('error', function(e){
                if(e.target && e.target.tagName === 'IMG'){ e.target.style.display = 'none'; }
              }, true);
            })();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
