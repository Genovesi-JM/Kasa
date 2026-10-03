import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Keep the static prototype portable between localhost and repository subpaths.
  base: "./",
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules\/(react|react-dom|scheduler)\//,
            },
            {
              name: "i18n-vendor",
              test: /node_modules\/(i18next|react-i18next|use-sync-external-store)\//,
            },
            {
              name: "icons-vendor",
              test: /node_modules\/lucide-react\//,
            },
            {
              name: "app-i18n",
              test: /[\\/]src[\\/]i18n\.ts$/,
            },
          ],
        },
      },
    },
  },
});
