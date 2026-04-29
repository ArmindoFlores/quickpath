import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        cors: {
            origin: "https://www.owlbear.rodeo",
        },
    },
    build: {
        rolldownOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
                background: resolve(__dirname, "background.html"),
            },
        },
    },
});
