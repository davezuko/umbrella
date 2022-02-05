import * as api from "./api"
import * as esbuild from "esbuild"

export let run = async (osArgs: string): Promise<number> => {
    let command = ""
    let flags: string[] = []
    for (let arg of osArgs) {
        if (arg[0] === "-") {
            flags.push(arg)
            continue
        }
        if (!command) {
            command = arg
            continue
        }
    }

    let toExitCode = async (result: Promise<any>) => {
        try {
            await result
            return 0
        } catch (e) {
            console.error(e.message)
            return 1
        }
    }

    let config = await api.loadProjectConfig()
    let buildOptions = api.createBuildOptions()
    let serveOptions = api.createServeOptions()

    switch (command) {
        case "build": {
            buildOptions.minify = true

            applyProjectConfig(config, buildOptions, serveOptions)
            applyCLIFlags(flags, buildOptions, serveOptions)

            return toExitCode(
                (async () => {
                    let result = await api.build(buildOptions)
                    if (result.metafile) {
                        let text = await esbuild.analyzeMetafile(
                            result.metafile,
                        )
                        console.log(text)
                    }
                })(),
            )
        }
        case "serve": {
            applyProjectConfig(config, buildOptions, serveOptions)
            applyCLIFlags(flags, buildOptions, serveOptions)

            return toExitCode(api.serve(serveOptions))
        }
        case "start": {
            buildOptions.minify = false

            applyProjectConfig(config, buildOptions, serveOptions)
            applyCLIFlags(flags, buildOptions, serveOptions)

            return toExitCode(api.start(buildOptions, serveOptions))
        }
        default: {
            return 1
        }
    }
}

let applyProjectConfig = (
    project: api.ProjectConfig,
    buildOptions: api.BuildOptions,
    serveOptions: api.ServeOptions,
) => {
    for (let [key, value] of Object.entries(project.build)) {
        buildOptions[key] = value
    }
    for (let [key, value] of Object.entries(project.serve)) {
        serveOptions[key] = value
    }
}

let applyCLIFlags = (
    flags: string[],
    buildOptions: api.BuildOptions,
    serveOptions: api.ServeOptions,
) => {
    let parseBoolFlag = (flag: string): boolean => {
        let val = flag.split("=")[1]
        if (!val) {
            return true
        }
        return flag === "1" || flag === "true"
    }

    for (let flag of flags) {
        if (flag.startsWith("--minify")) {
            buildOptions.minify = parseBoolFlag(flag)
            continue
        }
        if (flag.startsWith("--host")) {
            let val = flag.split("=")[1]
            if (val) {
                serveOptions.host = val
            }
            continue
        }
        if (flag.startsWith("--port")) {
            let val = flag.split("=")[1]
            if (val) {
                serveOptions.port = Number.parseInt(val)
            }
            continue
        }
    }
}
