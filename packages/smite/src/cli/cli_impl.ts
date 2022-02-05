import * as api from "../api/api"
import * as esbuild from "esbuild"

interface Context {
    projectConfig: api.ProjectConfig
    buildOptions: api.BuildOptions
    serveOptions: api.ServeOptions
}

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

    let projectConfig = await api.loadProjectConfig()
    let ctx: Context = {
        projectConfig,
        buildOptions: api.createBuildOptions(),
        serveOptions: api.createServeOptions(),
    }
    try {
        await runCommand(ctx, command, flags)
        return 0
    } catch (e) {
        console.error(e.message)
        return 1
    }
}

let runCommand = async (
    ctx: Context,
    command: string,
    flags: string[],
): Promise<void> => {
    switch (command) {
        case "debug": {
            finalizeConfig(ctx, flags)
            console.debug({
                build: ctx.buildOptions,
                serve: ctx.serveOptions,
            })
            break
        }
        case "build": {
            ctx.buildOptions.minify = true
            finalizeConfig(ctx, flags)
            let result = await api.build(ctx.buildOptions)
            if (result.metafile) {
                let text = await esbuild.analyzeMetafile(result.metafile)
                console.log(text)
            }
            break
        }
        case "serve": {
            finalizeConfig(ctx, flags)
            await api.serve(ctx.serveOptions)
            break
        }
        case "start": {
            ctx.buildOptions.minify = false
            finalizeConfig(ctx, flags)
            await api.start(ctx.buildOptions, ctx.serveOptions)
            break
        }
        default: {
            throw new Error(`unknown command: ${command}`)
        }
    }
}

let finalizeConfig = (ctx: Context, flags: string[]) => {
    let applyProjectConfig = (ctx: Context) => {
        for (let [key, value] of Object.entries(ctx.projectConfig.build)) {
            ctx.buildOptions[key] = value
        }
        for (let [key, value] of Object.entries(ctx.projectConfig.serve)) {
            ctx.serveOptions[key] = value
        }
    }

    applyCLIFlags(ctx, flags)
    applyProjectConfig(ctx)
}

let applyCLIFlags = (ctx: Context, flags: string[]) => {
    let parseBoolFlag = (flag: string): boolean => {
        let val = flag.split("=")[1]
        if (!val) {
            return true
        }
        return flag === "1" || flag === "true"
    }

    for (let flag of flags) {
        if (flag.startsWith("--minify")) {
            ctx.buildOptions.minify = parseBoolFlag(flag)
            continue
        }
        if (flag.startsWith("--host")) {
            let val = flag.split("=")[1]
            if (val) {
                ctx.serveOptions.host = val
            }
            continue
        }
        if (flag.startsWith("--port")) {
            let val = flag.split("=")[1]
            if (val) {
                ctx.serveOptions.port = Number.parseInt(val)
            }
            continue
        }
    }
}
