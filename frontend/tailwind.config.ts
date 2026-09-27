import type { Config } from "tailwindcss";

/**
 * CalLaw design tokens. Every color reads a CSS variable (see globals.css), so the
 * whole site switches between light and dark by toggling the `dark` class on <html>.
 *
 * ink     – text & primary actions (flips: navy on light, cream on dark)
 * paper   – page backgrounds & subtle fills (flips: warm white / deep night)
 * surface – cards and inputs
 * gold    – California gold accent; light tints and dark shades flip for contrast
 * sage    – "verified / grounded" states
 * night   – fixed dark palette (sidebar, dark bands) that stays dark in both themes
 * cream   – fixed light text used on `night` areas
 */
const scale = (name: string, steps: number[]) =>
  Object.fromEntries(steps.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: scale("ink", STEPS),
        night: scale("night", STEPS),
        paper: scale("paper", [50, 100, 200, 300, 400]),
        cream: scale("cream", [50, 100, 200, 300, 400]),
        gold: scale("gold", [50, 100, 200, 300, 400, 500, 600, 700]),
        sage: scale("sage", [50, 100, 500, 600, 700]),
        surface: "rgb(var(--surface) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
      },
    },
  },
  plugins: [],
};
export default config;
