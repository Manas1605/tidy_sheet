import type { Config } from "tailwindcss";

// Tailwind v4 primarily configures itself via `@theme` in app/globals.css
// and auto-detects which files to scan for class names — a JS/TS config
// file is optional. It's kept here (a) because the project spec calls for
// it explicitly, and (b) as the place to extend content globs, add
// plugins, or override the design tokens in globals.css if this project
// grows beyond what @theme covers.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
};

export default config;
