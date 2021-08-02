# @davezuko/config

My standard configuration files for eslint, prettier, and eventually more.

## Usage

```sh
yarn add --dev @davezuko/config

# install eslint and prettier peer dependencies
yarn add --dev prettier eslint
```

```js
// package.json
{
    "prettier": "@davezuko/config/prettier",
    "eslint": {
        "extends": "@davezuko/config/eslint"
    }
}
```
