import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  base: "./", // chemins relatifs : marche sur GitHub Pages (/Test02/) comme sur Netlify
  build: { rollupOptions: { input: { main: resolve(__dirname, "index.html"), diag: resolve(__dirname, "diag/index.html"), capteur: resolve(__dirname, "capteur.html") } } },
});
