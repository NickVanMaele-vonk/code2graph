import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // Exclude cloned-repos directory and stub test files from linting
  {
    ignores: [
      "cloned-repos/**/*",
      "test/visualizer.test.js" // Stub test file with commented-out tests pending visualizer refactoring
    ]
  },
  { 
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"], 
    plugins: { js }, 
    extends: ["js/recommended"], 
    languageOptions: { 
      globals: {
        ...globals.browser, 
        ...globals.node,
        cytoscape: 'readonly', // CDN-loaded library in visualizer/index.html
        cytoscapeDagre: 'readonly' // Change Request 002 - Phase 5: CDN-loaded dagre extension
      } 
    } 
  },
  tseslint.configs.recommended,
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: { react: pluginReact },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect", // Automatically detect React version
      },
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
    },
  },
]);
