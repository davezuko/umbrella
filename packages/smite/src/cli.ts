import * as api from "./api"

export let run = async (osArgs: string) => {
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
    switch (command) {
        case "build": {
            let buildOptions = api.createBuildOptions()
            buildOptions.minify = true
            applyBuildFlags(buildOptions, flags)

            await api.build(buildOptions)
            break
        }
        case "serve": {
            let serveOptions = api.createServeOptions()
            applyServeFlags(serveOptions, flags)

            await api.serve(serveOptions)
            break
        }
        case "start": {
            let buildOptions = api.createBuildOptions()
            buildOptions.minify = false
            applyBuildFlags(buildOptions, flags)

            let serveOptions = api.createServeOptions()
            applyServeFlags(serveOptions, flags)

            await api.start(buildOptions, serveOptions)
            break
        }
    }
}

let applyServeFlags = (options: api.ServeOptions, args: string[]) => {
    for (let arg of args) {
        if (arg.startsWith("--host")) {
            let val = arg.split("=")[1]
            if (val) {
                options.host = val
            }
        }
        if (arg.startsWith("--port")) {
            let val = arg.split("=")[1]
            if (val) {
                options.port = Number.parseInt(val)
            }
        }
    }
}

let applyBuildFlags = (options: api.BuildOptions, args: string[]) => {
    for (let arg of args) {
        if (arg.startsWith("--minify")) {
            options.minify = true
        }
    }
}
