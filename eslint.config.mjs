import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tsEslint from "typescript-eslint";

export default [
  {
    ignores: ["**/dist/", "test/output/", "test/input/"],
  },

  js.configs.recommended,

  {
    rules: {
      "no-param-reassign": "error",
    },

    languageOptions: {
      globals: globals.node,
    },
  },

  ...[
    ...tsEslint.configs.recommendedTypeChecked,
    ...tsEslint.configs.strictTypeChecked,
    ...tsEslint.configs.stylisticTypeChecked,

    {
      languageOptions: {
        parserOptions: {
          projectService: true,
        },
      },

      rules: {
        "@typescript-eslint/explicit-member-accessibility": [
          "error",
          {
            accessibility: "explicit",
            overrides: {
              constructors: "no-public",
            },
          },
        ],
        "@typescript-eslint/explicit-module-boundary-types": "error",
        "@typescript-eslint/restrict-template-expressions": [
          "error",
          {
            allowAny: false,
            allowBoolean: false,
            allowNullish: false,
            allowNumber: true,
            allowRegExp: false,
            allowNever: false,
          },
        ],
        "@typescript-eslint/no-confusing-void-expression": [
          "error",
          {
            ignoreArrowShorthand: true,
          },
        ],
      },
    },
  ].map(config => ({ ...config, files: ["**/*.ts"] })),

  {
    files: ["test/**/*.ts"],
    rules: { "@typescript-eslint/no-floating-promises": "off" },
  },

  eslintConfigPrettier,
];
