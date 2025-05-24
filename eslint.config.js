import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import vitestPlugin from 'eslint-plugin-vitest'; // <--- Import the Vitest plugin

export default [
  { ignores: ["dist"] },
  { // General config for all JS/JSX files
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2020, // This can often be 'latest' too, matching parserOptions
      globals: {
        ...globals.browser, // Keep browser globals
        // Add any other custom globals for your main app code if needed
      },
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "no-unused-vars": ["error", { "varsIgnorePattern": "^[_A-Z]" }],
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Add any other general rules here
    },
  },
  { // Vitest specific configuration
    files: ['**/*.test.js', '**/*.test.jsx', '**/*.spec.js', '**/*.spec.jsx'], // Apply only to test files
    plugins: {
      vitest: vitestPlugin,
    },
    rules: {
      // You can include all recommended Vitest rules
      ...vitestPlugin.configs.recommended.rules,
      // Or pick specific rules if you prefer
      // e.g., 'vitest/expect-expect': 'error',

      // You might want to disable or adjust some general rules for test files
      // For example, if you use anonymous functions extensively in `it` blocks:
      // 'func-names': 'off',
    },
    languageOptions: {
      globals: {
        ...globals.browser, // It's good to keep browser globals if tests interact with DOM
        ...vitestPlugin.environments.globals.globals, // <--- Add Vitest globals
      }
    }
  }
];