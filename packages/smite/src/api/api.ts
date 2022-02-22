import * as esbuild from "esbuild"
import * as impl from "./api_impl"

export type BuildOptions = esbuild.BuildOptions

export interface ProjectConfig {
    build: Partial<BuildOptions>
    serve: Partial<ServeOptions>
}

export interface RunOptions {
    inputFile: string
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

export interface CreateProjectOptions {
    dir: string
    template: {
        url: string
        dir: string
    }
}

export interface CreateProjectResult {
    dir: string
}

export let loadProjectConfig = (dir?: string): Promise<ProjectConfig> => {
    return impl.loadProjectConfig(dir)
}

export let createBuildOptions = (): BuildOptions => {
    return impl.createBuildOptions()
}

export let createNewProject = (
    options: CreateProjectOptions,
): Promise<CreateProjectResult> => {
    return impl.createNewProject(options)
}

export let createServeOptions = (): ServeOptions => {
    return impl.createServeOptions()
}

export let build = (buildOptions: BuildOptions) => {
    return impl.build(buildOptions)
}

export let run = (runOptions: RunOptions) => {
    return impl.run(runOptions)
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
