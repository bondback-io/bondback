import nextPlugin from "eslint-config-next";

/**
 * Next 16 + eslint-config-next enables strict React Compiler–adjacent rules (`react-hooks/purity`,
 * `set-state-in-effect`, etc.) that misfire on Server Components (`Date.now` in async pages) and
 * common client patterns (hydration, localStorage). Keep them off until the ecosystem aligns.
 */
const config = [
  ...nextPlugin,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "import/no-anonymous-default-export": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      /** RHF `watch()` patterns; Compiler skips memoization safely. */
      "react-hooks/incompatible-library": "off",
      /** Many intentional omission cases; re-enable incrementally if desired. */
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    files: ["**/*.config.{js,mjs,cjs}", "postcss.config.mjs"],
    rules: {
      "import/no-anonymous-default-export": "off",
    },
  },
];

export default config;
