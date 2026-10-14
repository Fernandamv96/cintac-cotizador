/** @type {import('tailwindcss').Config} */
// Los colores apuntan a variables CSS (src/index.css) para que cambien con el tema.
const variable = (nombre) => `rgb(var(${nombre}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        papel: variable("--rgb-fondo"),
        tinta: variable("--rgb-texto"),
        acero: variable("--rgb-texto"),
        "acero-claro": variable("--rgb-suave"),
        ambar: variable("--rgb-ambar"),
        naranja: variable("--rgb-naranja"),
        exito: variable("--rgb-exito"),
        peligro: variable("--rgb-peligro"),
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
      },
      fontSize: {
        base: ["1.05rem", "1.6rem"],
        lg: ["1.2rem", "1.75rem"],
      },
    },
  },
  plugins: [],
};
