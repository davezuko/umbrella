import * as fs from "fs"
import * as path from "path"
import * as util from "util"
import * as esbuild from "esbuild"
import * as express from "express"
import * as compression from "compression"
import copydir from "copy-dir"
import type {
    BuildOptions,
    CreateProjectOptions,
    CreateProjectResult,
    ProjectConfig,
    ServeOptions,
    ServeResult,
} from "./api"

export let loadProjectConfig = async (): Promise<ProjectConfig> => {
    let dir = process.cwd()
    let prv = ""
    while (prv !== dir) {
        prv = dir
        try {
            let file = path.join(dir, "package.json")
            console.debug("looking for nearest package.json, trying: %s", file)
            let raw = await fs.promises.readFile(file, "utf8")
            console.debug("using package.json file: %s", file)
            let pkg = JSON.parse(raw)
            let cfg = readPackageJSON(pkg)
            cfg.build.absWorkingDir = file
            return cfg
        } catch (e) {}
        dir = path.join(dir, "..")
    }
    return {
        build: {},
        serve: {},
    }
}

export let readPackageJSON = (pkg: {[key: string]: any}): ProjectConfig => {
    console.debug("read package.json", pkg)
    let config: ProjectConfig = {
        build: {},
        serve: {},
    }
    if (pkg.smite) {
        if (typeof pkg.smite.build === "object") {
            config.build = pkg.smite.build
        }
        if (typeof pkg.smite.serve === "object") {
            config.serve = pkg.smite.serve
        }
    }

    if (!config.build.entryPoints) {
        if (typeof pkg.exports === "object") {
            config.build.entryPoints = {}
            for (let entry of Object.entries(pkg.exports)) {
                let [outpath, srcpath] = entry
                if (typeof srcpath === "string") {
                    outpath = outpath.replace(".js", "")
                    config.build.entryPoints[outpath] = srcpath
                }
            }
        }
    }
    return config
}

export let createBuildOptions = (): BuildOptions => {
    return {
        entryPoints: [],
        minify: false,
        platform: "browser",
        target: "esnext",
        outdir: "dist",
        metafile: true,
        plugins: [],
    }
}

export let createServeOptions = (): ServeOptions => {
    return {
        protocol: "http",
        host: "localhost",
        port: 3000,
    }
}

export let build = async (buildOptions: BuildOptions) => {
    // clean outdir
    await fs.promises.rm(buildOptions.outdir, {recursive: true, force: true})

    // build
    let result = await esbuild.build(buildOptions)

    // copy statics
    try {
        let stat = await fs.promises.lstat("./static")
        if (stat.isDirectory()) {
            await util.promisify(copydir)("./static", "./dist")
        }
    } catch (e) {}
    return result
}

export let serve = async (serveOptions: ServeOptions) => {
    let app = express()
    app.use(compression())
    let server = app.listen(serveOptions.port, () => {
        console.log(
            "server running at %s://%s:%s",
            serveOptions.protocol,
            serveOptions.host,
            serveOptions.port,
        )
    })
    return {
        host: serveOptions.host,
        port: serveOptions.port,
        async stop() {
            return new Promise<void>((resolve, reject) => {
                server.close((err) => {
                    if (err) {
                        reject(err)
                    } else {
                        resolve()
                    }
                })
            })
        },
    }
}

export let start = async (
    buildOptions: BuildOptions,
    serveOptions: ServeOptions,
): Promise<ServeResult> => {
    let result = await esbuild.serve(
        {
            host: serveOptions.host,
            port: serveOptions.port,
        },
        buildOptions,
    )
    return {
        port: result.port,
        host: result.host,
        async stop() {
            result.stop()
        },
    }
}

export let createNewProject = async (
    options: CreateProjectOptions,
): Promise<CreateProjectResult> => {
    let result: CreateProjectResult = {
        dir: options.dir,
    }
    throw new Error("not implemented")
    return result
}
