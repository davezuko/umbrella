import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import * as esbuild from "esbuild"
import {sprintf} from "sprintf-js"
import {Test, TestFn} from "./api"
import {TestSuite} from ".."

const IGNORE_DIRS = new Set(["node_modules", "dist"])
const TEST_PATTERN = /\.test\.(js|jsx|ts|tsx)$/
let _registeredTests: Test[] = []

export let test = (name: string, fn: TestFn) => {
    let test = {name, func: fn}
    _registeredTests.push(test)
}

export let run = async (): Promise<TestSuite[]> => {
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

export let runFile = async (file: string): Promise<TestSuite> => {
    console.log("run test file: %s", file)
    let name = path.basename(file, path.extname(file))
    let suffix = ""
    let outfile = path.join(TEMPDIR, name + suffix + ".js")
    console.log("bundle %s -> %s", file, outfile)

    let bundle = await esbuild.build({
        entryPoints: [file],
        outfile,
        bundle: true,
        splitting: false,
        format: "cjs",
        platform: "node",
        target: "es2020",
        // logLevel: "info",
    })
    if (bundle.errors.length) {
        return {
            type: "error",
            message: "failed to bundle test file",
            errors: bundle.errors,
        }
    }
    return {
        type: "success",
    }
}

const STOP_TEST = Symbol()

export class TestUtil {
    errors: string[]
    logs: string[]
    failed: boolean
    state: TestRunState

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
