import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const PORT = parseInt(process.env.VITE_PORT || '3000');

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: PORT,
    hmr: {
      overlay: false,
    },
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('@apollo/client') || id.includes('graphql')) {
              return 'vendor-apollo';
            }
            if (id.includes('recharts')) {
              return 'vendor-recharts';
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-radix';
            }
          }
        },
      },
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
