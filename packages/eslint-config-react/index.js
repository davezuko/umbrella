module.exports = {
    parser: "@typescript-eslint/parser",
    extends: ["plugin:react/recommended"],
    settings: {
        react: {
            version: "detect",
        },
    },
    rules: {
        "react/no-unescaped-entities": 0,
        "react/prop-types": 0,
    },
}
