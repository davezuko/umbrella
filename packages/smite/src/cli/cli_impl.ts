import * as api from "../api/api"
import * as esbuild from "esbuild"
import {createCLI} from "@davezuko/cli"

let cli = createCLI()

cli.command("debug", {
    async run(_ctx, args) {
        let options = await finalizeOptions(args)
        console.debug({
            build: options.buildOptions,
            serve: options.serveOptions,
        })
    },
})

cli.command("build", {
    async run(_ctx, args) {
        let options = await finalizeOptions(args, (ctx) => {
            ctx.buildOptions.minify = true
        })
        let result = await api.build(options.buildOptions)
        if (result.metafile) {
            let text = await esbuild.analyzeMetafile(result.metafile)
            console.log(text)
        }
    },
})

cli.command("new", {
    async run(_ctx, args) {
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
    },
})

cli.command("run", {
    async run(_ctx, args) {
        let options: api.RunOptions = {
            inputFile: "",
        }
        for (let arg of args) {
            if (arg[0] !== "-") {
                options.inputFile = arg
                break
            }
        }
        await api.run(options)
    },
})

cli.command("serve", {
    async run(_ctx, args) {
        let options = await finalizeOptions(args)
        await api.serve(options.serveOptions)
    },
})

cli.command("start", {
    async run(_ctx, args) {
        let options = await finalizeOptions(args, (project) => {
            project.buildOptions.minify = false
        })
        await api.start(options.buildOptions, options.serveOptions)
    },
})

interface ProjectOptions {
    buildOptions: api.BuildOptions
    serveOptions: api.ServeOptions
}

let finalizeOptions = async (
    args: string[],
    customize?: (project: ProjectOptions) => void,
): Promise<ProjectOptions> => {
    let options: ProjectOptions = {
        buildOptions: api.createBuildOptions(),
        serveOptions: api.createServeOptions(),
    }

    // customize defaults before applying overrides
    if (customize) {
        await customize(options)
    }

    // apply project configuration
    let project = await api.loadProjectConfig()
    for (let [key, value] of Object.entries(project.build)) {
        ;(options as any).buildOptions[key] = value
    }
    for (let [key, value] of Object.entries(project.serve)) {
        ;(options as any).serveOptions[key] = value
    }

    applyCLIArgs(options, args)
    return options
}

let applyCLIArgs = (options: ProjectOptions, args: string[]) => {
    let parseBool = (arg: string): boolean => {
        let val = arg.split("=")[1]
        if (!val) {
            return true
        }
        return arg === "1" || arg === "true"
    }

    for (let arg of args) {
        if (arg.startsWith("--minify")) {
            options.buildOptions.minify = parseBool(arg)
            continue
        }
        if (arg.startsWith("--host")) {
            let val = arg.split("=")[1]
            if (val) {
                options.serveOptions.host = val
            }
            continue
        }
        if (arg.startsWith("--port")) {
            let val = arg.split("=")[1]
            if (val) {
                options.serveOptions.port = Number.parseInt(val)
            }
            continue
        }
    }
}

export let run = async (osArgs: string[]): Promise<number> => {
    return cli.run(osArgs)
}
