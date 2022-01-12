# @davezuko/esbuild-plugin-preact

JavaScript plugin for esbuild that replaces "react" and "react-dom" with "preact/compat".

```js
import * as esbuild from "esbuild"
import {esbuildPluginPreact} from "@davezuko/esbuild-plugin-react"

esbuild.build({
    plugins: [
        esbuildPluginPreact({
            // set to true to remove "preact/debug" from the bundle.
            stripDevtools: false,
        })
    ],
})
```