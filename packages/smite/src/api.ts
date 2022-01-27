import * as esbuild from "esbuild"
import * as express from "express"
import * as compression from "compression"

export interface BuildOptions {
    minify: boolean
}

export interface ServeOptions {
    protocol: "http" | "https"
    host: string
    port: number
}

export let createBuildOptions = (): BuildOptions => {
    return {
        minify: false,
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
    let result = await esbuild.build({
        entryPoints: [],
    })
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
    return app
}

export let start = async (
    buildOptions: BuildOptions,
    serveOptions: ServeOptions,
) => {}
