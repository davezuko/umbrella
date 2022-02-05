# @davezuko/smite

Opinionated build tool for JavaScript applications.

```sh
yarn add --dev @davezuko/smite
```

## Usage

```sh
# start the development server
yarn smite start

# build the application to disk
yarn smite build

# serve the built application
yarn smite serve

# cli flags
yarn

```

```js
import * as smite from "smite"

smite.build().then((result) => {
    console.log("built!")
})
```

## Configuration

```json
// package.json
{
    "smite": {
        "build": {
            "entryPoints": ["./src/main.ts", "./src/main.css"],
            "minify": false
        },
        "serve": {
            "port": 8080,
            "host": "localhost"
        }
    }
}
```

```json
// package.json
{
    "exports": {
        "./main.js": "./src/main.ts",
        "./sample.js": "./src/app.ts"
    }
}
```
