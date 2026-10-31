/** @type {import('postcss').Config} */
const config = {
  plugins: {
    // @tailwindcss/postcss kept for pipeline compatibility (installed per Phase 0 stack).
    // No @import "tailwindcss" in globals.css — Distillerie uses only CSS custom properties.
    "@tailwindcss/postcss": {},
  },
};
export default config;
