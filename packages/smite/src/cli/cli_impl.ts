import * as api from "../api/api"
import * as esbuild from "esbuild"

interface Context {
    buildOptions: api.BuildOptions
    serveOptions: api.ServeOptions
}

export let run = async (osArgs: string): Promise<number> => {
    let command = ""
    let args: string[] = []
    for (let arg of osArgs) {
        if (!command) {
            command = arg
        } else {
            args.push(arg)
        }
    }
    try {
        await runCommand(command, args)
        return 0
    } catch (e) {
        console.error(e.message)
        return 1
    }
}

let runCommand = async (command: string, args: string[]): Promise<void> => {
    switch (command) {
        case "debug": {
            let ctx = await finalizeOptions(args)
            console.debug({
                build: ctx.buildOptions,
                serve: ctx.serveOptions,
            })
            break
        }
        case "build": {
            let ctx = await finalizeOptions(args, (ctx) => {
                ctx.buildOptions.minify = true
            })
            let result = await api.build(ctx.buildOptions)
            if (result.metafile) {
                let text = await esbuild.analyzeMetafile(result.metafile)
                console.log(text)
            }
            break
        }
        case "new": {
            let options: api.CreateProjectOptions = {
                dir: "",
                template: {
                    url: "",
                    dir: "",
                },
            }
            for (let arg of args) {
                if (!options.dir && arg[0] !== "-") {
                    options.dir = arg
                    continue
                }
                let [name, value] = arg.split("=")
                switch (name) {
                    case "url":
                        options.template.url = value
                        break
                    case "dir":
                        options.template.dir = value
                        break
                }
            }
            if (!options.template.url) {
                options.template.url = "https://github.com/davezuko/templates"
                options.template.dir = "web-app"
            }
            await api.createNewProject(options)
            break
        }
        case "serve": {
            let ctx = await finalizeOptions(args)
            await api.serve(ctx.serveOptions)
            break
        }
        case "start": {
            let ctx = await finalizeOptions(args, (ctx) => {
                ctx.buildOptions.minify = false
            })
            await api.start(ctx.buildOptions, ctx.serveOptions)
            break
        }
        default: {
            throw new Error(`unknown command: ${command}`)
        }
    }
}

let finalizeOptions = async (
    args: string[],
    customize?: (ctx: Context) => void,
): Promise<Context> => {
    let ctx: Context = {
        buildOptions: api.createBuildOptions(),
        serveOptions: api.createServeOptions(),
    }

    // customize defaults before applying overrides
    if (customize) {
        await customize(ctx)
    }

    // apply project configuration
    let project = await api.loadProjectConfig()
    for (let [key, value] of Object.entries(project.build)) {
        ctx.buildOptions[key] = value
    }
    for (let [key, value] of Object.entries(project.serve)) {
        ctx.serveOptions[key] = value
    }

    // apply cli overrides
    applyCLIArgs(ctx, args)
    return ctx
}

let applyCLIArgs = (ctx: Context, args: string[]) => {
    let parseBool = (arg: string): boolean => {
        let val = arg.split("=")[1]
        if (!val) {
            return true
        }
        return arg === "1" || arg === "true"
    }

    for (let arg of args) {
        if (arg.startsWith("--minify")) {
            ctx.buildOptions.minify = parseBool(arg)
            continue
        }
        if (arg.startsWith("--host")) {
            let val = arg.split("=")[1]
            if (val) {
                ctx.serveOptions.host = val
            }
            continue
        }
        if (arg.startsWith("--port")) {
            let val = arg.split("=")[1]
            if (val) {
                ctx.serveOptions.port = Number.parseInt(val)
            }
            continue
        }
    }
}
