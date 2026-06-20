const js = require("@eslint/js");
const globals = require("globals");
const eslintConfigPrettier = require("eslint-config-prettier");
module.exports = [
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    files: ["**/*.{js,mjs,cjs}"],
    ignores: ["{dist,public}/**/*"],
  },
  js.configs.recommended,
  eslintConfigPrettier,
];
