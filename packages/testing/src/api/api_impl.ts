import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import * as esbuild from "esbuild"
import {sprintf} from "sprintf-js"
import * as api from "./api"

const IGNORE_DIRS = new Set(["node_modules", "dist"])
const TEST_PATTERN = /\.test\.(ts|tsx)$/

let _registeredTests: api.Test[] = []

export let test = (name: string, fn: api.TestFn) => {
    let test = {name, func: fn}
    _registeredTests.push(test)
}

export let run = async (): Promise<api.TestSuiteResult[]> => {
    let tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "testrunner-"))
    let testFiles = await findTestFiles()

    // TODO: maybe bundle all tests together
    let results = await Promise.all(
        testFiles.map((file) => {
            return runFile(file)
        }),
    )
    try {
        await fs.promises.rm(tmp, {recursive: true, force: true})
    } catch (e) {
        console.warn("failed to cleanup temporary directory: %s", tmp, e)
    }
    // @ts-expect-error
    return results
}

let findTestFiles = async (): Promise<string[]> => {
    let result: string[] = []
    let walk = async (dir: string) => {
        let names = await fs.promises.readdir(dir)
        await Promise.all(
            names.map(async (name) => {
                if (IGNORE_DIRS.has(name)) {
                    return
                }
                let p = path.join(dir, name)
                try {
                    let stat = await fs.promises.stat(p)
                    if (stat.isDirectory()) {
                        await walk(p)
                    } else if (stat.isFile()) {
                        if (TEST_PATTERN.test(name)) {
                            result.push(p)
                        }
                    }
                } catch (e) {
                    console.warn("failed to walk: %s: %s", p, e)
                }
            }),
        )
    }
    await walk(process.cwd())
    return result
}

export let runFile = async (file: string): Promise<api.TestSuiteResult> => {
    let suite = new TestSuite(file)
    let buildResult = await suite.build()
    if (!buildResult.ok)
        if (!(await suite.build())) {
            return {
                suite,
                type: "error",
                message: "Failed to build",
            }
        }
    return suite
}

class TestSuite {
    file: string
    outfile: string

    constructor(file: string) {
        this.file = file
        this.outfile = ""
    }

    async build(): Promise<Result<void, string>> {
        let prefix = path.join(os.tmpdir(), "testing-")
        let tmp = await fs.promises.mkdtemp(prefix)
        this.outfile = path.join(tmp, "script.js")
        let bundle = await esbuild.build({
            entryPoints: [this.file],
            outfile: this.outfile,
            bundle: true,
            splitting: false,
            format: "cjs",
            platform: "node",
            target: "es2020",
        })
        if (bundle.errors.length) {
            return Result.error("esbuild failed with errors")
        }
        return Result.ok()
    }
}

class Result<T, E> {
    data?: T
    error?: E
    type: string

    constructor(data?: T, error?: E) {
        this.type = ""
        this.data = data
        this.error = error
    }

    ok(): asserts this is {type: "ok"; data: T} {
        return this.type === "ok"
    }

    static error<T, E = string>(message: E): Result<T, E> {
        return new Result<T, E>(null as any, message)
    }

    static ok<T, E = string>(data?: T): Result<T, E> {
        return new Result(data)
    }
}

const STOP_TEST = Symbol()

export class TestUtil {
    errors: string[]
    logs: string[]
    failed: boolean
    state: any

    constructor() {
        this.errors = []
        this.logs = []
        this.state = "idle"
        this.failed = false
    }

    fail(): void {
        this.failed = true
    }

    failNow(): void {
        this.failed = true
        throw STOP_TEST
    }

    skip(): void {
        this.state = "skipped"
        throw STOP_TEST
    }

    skipf(format: string, ...args: any[]): void {
        this.logf(format, ...args)
        this.skip()
    }

    log(msg: string): void {
        this.logs.push(msg)
    }

    logf(format: string, ...args: any[]): void {
        this.log(sprintf(format, ...args))
    }

    error(msg: string) {
        this.errors.push(msg)
        this.fail()
    }

    errorf(format: string, ...args: any[]): void {
        this.error(sprintf(format, ...args))
    }

    fatalf(format: string, ...args: any[]): void {
        this.errorf(format, ...args)
        this.failNow()
    }
}
