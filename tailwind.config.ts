import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "studio-bg": "#050505",
        "studio-fg": "#FFFFFF",
        "studio-border": "#222222",
        "studio-dim": "#888888",
        background: "#050505",
        foreground: "#FFFFFF",
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      letterSpacing: {
        "widest-2": "0.2em",
        "widest-3": "0.3em",
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(200%)" },
        },
        "grain-shift": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "10%": { transform: "translate(-1%, -1%)" },
          "20%": { transform: "translate(1%, 1%)" },
          "30%": { transform: "translate(-1%, 1%)" },
          "40%": { transform: "translate(1%, -1%)" },
          "50%": { transform: "translate(-1%, 0%)" },
          "60%": { transform: "translate(0%, 1%)" },
          "70%": { transform: "translate(1%, 0%)" },
          "80%": { transform: "translate(0%, -1%)" },
          "90%": { transform: "translate(-1%, 1%)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "92%": { opacity: "1" },
          "93%": { opacity: "0.7" },
          "94%": { opacity: "1" },
          "96%": { opacity: "0.85" },
          "97%": { opacity: "1" },
        },
        "width-drain": {
          "0%": { width: "100%" },
          "100%": { width: "0%" },
        },
        "denied-pulse": {
          "0%, 100%": {
            borderColor: "rgb(185 28 28)",
            boxShadow:
              "0 0 0 1px rgb(220 38 38 / 0.5), 0 0 32px rgb(220 38 38 / 0.2), inset 0 0 60px rgb(69 10 10 / 0.35)",
          },
          "50%": {
            borderColor: "rgb(248 113 113)",
            boxShadow:
              "0 0 0 2px rgb(239 68 68 / 0.95), 0 0 56px rgb(239 68 68 / 0.45), inset 0 0 100px rgb(127 29 29 / 0.4)",
          },
        },
      },
      animation: {
        scan: "scan 2.2s ease-in-out forwards",
        "grain-shift": "grain-shift 0.15s steps(1) infinite",
        flicker: "flicker 8s infinite",
        "denied-pulse": "denied-pulse 2.2s ease-in-out infinite",
        "width-drain": "width-drain 4s linear forwards",
      },
    },
  },
  plugins: [],
};
export default config;
