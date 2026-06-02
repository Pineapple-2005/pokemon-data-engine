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
        pokemon: {
          red: "#EF4444",
          blue: "#3B82F6",
          yellow: "#EAB308",
          green: "#22C55E",
          purple: "#A855F7",
          orange: "#F97316",
        },
      },
    },
  },
  plugins: [],
};
export default config;
