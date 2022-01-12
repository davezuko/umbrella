import * as path from "path"
import type {PluginBuild} from "esbuild"

export interface Options {
    /** set to true to remove preact/debug devtools from the bundle */
    stripDevtools?: boolean
}
export let esbuildPluginPreact = (options: Options = {}) => {
    return {
        name: "preact",
        setup(build: PluginBuild) {
            if (options.stripDevtools) {
                build.onLoad(
                    {filter: /^preact\/debug$/, namespace: "preact/debug"},
                    () => {
                        return {
                            contents: "",
                        }
                    },
                )
                build.onResolve({filter: /^preact\/debug$/}, () => {
                    return {
                        path: "preact/debug",
                        namespace: "preact/debug",
                    }
                })
            }
            build.onResolve({filter: /^(react|react-dom)$/}, (_args) => {
                return {
                    path: path.join(
                        process.cwd(),
                        "node_modules/preact/compat/dist/compat.module.js",
                    ),
                }
            })
        },
    }
}
