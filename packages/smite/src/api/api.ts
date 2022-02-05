import * as esbuild from "esbuild"
import * as impl from "./api_impl"

export type BuildOptions = esbuild.BuildOptions

export interface ProjectConfig {
    build: Partial<BuildOptions>
    serve: Partial<ServeOptions>
}

export interface ServeOptions {
    protocol: "http" | "https"
    host: string
    port: number
}

export interface ServeResult {
    host: string
    port: number
    stop(): Promise<void>
}

export let loadProjectConfig = (): Promise<ProjectConfig> => {
    return impl.loadProjectConfig()
}

export let createBuildOptions = (): BuildOptions => {
    return impl.createBuildOptions()
}

export let createServeOptions = (): ServeOptions => {
    return impl.createServeOptions()
}

export let build = (buildOptions: BuildOptions) => {
    return impl.build(buildOptions)
}

export let serve = (serveOptions: ServeOptions) => {
    return impl.serve(serveOptions)
}

export let start = (
    buildOptions: BuildOptions,
    serveOptions: ServeOptions,
): Promise<ServeResult> => {
    return impl.start(buildOptions, serveOptions)
}
