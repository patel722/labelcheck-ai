import js from "@eslint/js";
import tseslint from "typescript-eslint";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "cloudflare-env.d.ts",
      "node_modules/**",
      "coverage/**",
      "public/realistic-samples/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
