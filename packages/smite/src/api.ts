import * as fs from "fs"
import * as path from "path"
import * as esbuild from "esbuild"
import * as express from "express"
import * as compression from "compression"

export type BuildOptions = esbuild.BuildOptions

export interface ServeOptions {
    protocol: "http" | "https"
    host: string
    port: number
}

export interface ProjectConfig {
    build: Partial<BuildOptions>
    serve: Partial<ServeOptions>
}

export let loadProjectConfig = async (): Promise<ProjectConfig> => {
    let config: ProjectConfig = {
        build: {},
        serve: {},
    }
    let dir = process.cwd()
    let prv = ""
    while (prv !== dir) {
        prv = dir
        try {
            let file = path.join(dir, "package.json")
            console.debug("looking for nearest package.json, trying: %s", file)
            let raw = await fs.promises.readFile(file, "utf8")
            let pkg = JSON.parse(raw)
            if (pkg.smite) {
                console.debug("loaded project config from: %s", file)
                if (typeof pkg.smite.build === "object") {
                    config.build = pkg.smite.build
                }
                if (typeof pkg.smite.serve === "object") {
                    config.serve = pkg.smite.serve
                }
            } else {
                console.debug("no 'smite' key present in: %s", file)
            }
            break
        } catch (e) {}
        dir = path.join(dir, "..")
    }
    return config
}

export let createBuildOptions = (): BuildOptions => {
    return {
        entryPoints: [],
        minify: false,
        platform: "browser",
        target: "esnext",
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
    let result = await esbuild.build(buildOptions)
    return result
}

export interface ServeResult {
    host: string
    port: number
    stop(): Promise<void>
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
