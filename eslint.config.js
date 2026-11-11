import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "scratch"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Providers and their hooks intentionally live together; the listed names are the deliberate non-component exports.
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          allowExportNames: [
            "useVault", "useStartVault", "useAutoLockCountdown", "takeLockReason", "readLastVaultId", "AUTO_LOCK_OPTIONS",
            "useTheme", "useEntrySheet", "buttonVariants", "toast",
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);

