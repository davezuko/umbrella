module.exports = {
    parser: "@typescript-eslint/parser",
    extends: [
        "plugin:@typescript-eslint/recommended",
        "plugin:prettier/recommended",
    ],
    settings: {
        react: {
            version: "detect",
        },
    },
    rules: {
        "prefer-const": 0,
        "prettier/prettier": [
            "error",
            {
                endOfLine: "auto",
            },
        ],
        "@typescript-eslint/explicit-module-boundary-types": 0,
        "@typescript-eslint/ban-ts-comment": 0,
        "@typescript-eslint/no-non-null-assertion": 0,
        "@typescript-eslint/no-explicit-any": 0,
        "@typescript-eslint/no-this-alias": 0,
        "@typescript-eslint/no-unused-vars": [
            "error",
            {
                argsIgnorePattern: "^_",
            },
        ],
    },
    overrides: [
        {
            files: ["*.js"],
            rules: {
                "@typescript-eslint/no-var-requires": 0,
            },
        },
    ],
}
