import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Flat ESLint config tuned for Next 16 + ESLint 10  -  we deliberately
 * skip `next lint` (deprecated) and the legacy-config compat dance
 * which trips on circular plugin refs in ESLint 10.
 */
export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "_argus/**",
      "_forenix/**",
      "scripts/**",
      "private/**",
      "prisma/dev.db",
      "**/*.d.ts",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        process: "readonly",
        console: "readonly",
        fetch: "readonly",
        Response: "readonly",
        Request: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        EventSource: "readonly",
        window: "readonly",
        document: "readonly",
        HTMLElement: "readonly",
        KeyboardEvent: "readonly",
        React: "readonly",
        globalThis: "readonly",
        RequestInit: "readonly",
        Headers: "readonly",
        URLSearchParams: "readonly",
        HTMLInputElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLButtonElement: "readonly",
        AbortController: "readonly",
        navigator: "readonly",
        TextDecoder: "readonly",
        TextEncoder: "readonly",
        Buffer: "readonly",
        AbortSignal: "readonly",
        confirm: "readonly",
        File: "readonly",
        FormData: "readonly",
        ReadableStream: "readonly",
        BodyInit: "readonly",
        NodeJS: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    files: ["prisma/seed.ts"],
    rules: {
      // The seed is a long imperative script  -  disable noisy rules.
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
];
