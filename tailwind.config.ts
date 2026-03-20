import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "#0052CC",
          foreground: "#ffffff",
          50: "#eef0ff",
          100: "#dae2ff",
          200: "#b2c5ff",
          300: "#89a9ff",
          400: "#5c8cff",
          500: "#3870ea",
          600: "#0c56d0",
          700: "#0052CC",
          800: "#002b73",
          900: "#001848",
        },
        secondary: {
          DEFAULT: "#42526E",
          foreground: "#ffffff",
          50: "#ecf0ff",
          100: "#d6e3ff",
          200: "#b7c7e8",
          300: "#9baccc",
          400: "#8191b0",
          500: "#677895",
          600: "#4f5f7b",
          700: "#42526E",
          800: "#20314b",
          900: "#091c35",
        },
        tertiary: {
          DEFAULT: "#00B8D9",
          50: "#d9f5ff",
          100: "#afecff",
          200: "#48d7f9",
          300: "#0fbbdc",
          400: "#009ebb",
          500: "#00829a",
          600: "#00687b",
          700: "#00B8D9",
        },
        neutral: {
          DEFAULT: "#091E42",
          50: "#edf0ff",
          100: "#d8e2ff",
          200: "#b4c6f3",
          300: "#99abd7",
          400: "#7f90bb",
          500: "#6577a0",
          600: "#4c5e85",
          700: "#35466c",
          800: "#1d3054",
          900: "#091E42",
        },
        surface: "#F4F5F7",
        success: "#36B37E",
        warning: "#FFAB00",
        danger: "#FF5630",
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "#FF5630",
          foreground: "#ffffff",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
