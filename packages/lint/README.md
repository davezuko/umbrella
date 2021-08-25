# @davezuko/lint

My preferred linter configuration. It's a helpful wrapper around [@davezuko/prettier-config](../prettier-config) and [@davezuko/eslint-config](../eslint-config) since eslint and prettier both require NPM packages to follow a specific naming convention (I can't combine them).

## Usage

```sh
yarn add --dev @davezuko/lint
```

```js
// package.json
{
    "prettier": "@davezuko/prettier-config",
    "eslintConfig": {
        "extends": "@davezuko/eslint-config"
    }
}
```
