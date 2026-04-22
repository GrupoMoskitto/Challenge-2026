import { baseConfig } from "@crmed/config/eslint.base.js";

export default [
  ...baseConfig,
  {
    ignores: ["dist", "node_modules", ".turbo"]
  }
];
