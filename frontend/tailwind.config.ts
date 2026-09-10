import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#F5F0E8",
          light: "#FAF8F3",
          dark: "#EDE5D8",
        },
        charcoal: {
          DEFAULT: "#1C1C1A",
          mid: "#2E2E2B",
        },
        stone: {
          DEFAULT: "#8C8279",
          light: "#B5AFA7",
          lighter: "#D6D2CC",
        },
        amber: {
          DEFAULT: "#B8813A",
          light: "#D4A05A",
          dark: "#8C5E20",
        },
      },
      fontFamily: {
        serif: ["Cormorant Garamond", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
