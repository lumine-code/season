const js = require("@eslint/js");
const n = require("eslint-plugin-n");
const globals = require("globals");
const prettier = require("eslint-config-prettier");

module.exports = [
  { ignores: ["node_modules/**", "build/**", "**/fixtures/**"] },
  js.configs.recommended,
  n.configs["flat/recommended-script"],
  {
    settings: {
      n: { version: ">=24.0.0" },
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
      // A catch that deliberately swallows is idiomatic here -- `catch {}` with
      // no binding already says the error is unwanted.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // The lint configuration itself requires devDependencies; it never ships.
    files: ["eslint.config.js", "prettier.config.js"],
    rules: {
      "n/no-unpublished-require": "off",
      "n/no-extraneous-require": "off",
    },
  },
  {
    files: ["spec/**", "test/**", "scripts/**", "benchmark/**"],
    languageOptions: {
      globals: {
        ...globals.jasmine,
        ...globals.mocha,
      },
    },
    rules: {
      "n/no-unpublished-require": "off",
      "n/no-extraneous-require": "off",
      "n/no-process-exit": "off",
    },
  },
  // Must be last: turns off any lint rules that would conflict with Prettier.
  prettier,
];
