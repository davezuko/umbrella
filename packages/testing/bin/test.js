#!/usr/bin/env node
import fs from "fs"
import os from "os"
import path from "path"
import esbuild from "esbuild"

const IGNORE_DIRS = new Set(["node_modules", "dist"])
const TEST_PATTERN = /\.test\.(js|jsx|ts|tsx)$/
let TEMPDIR

let main = async () => {
    TEMPDIR = await fs.promises.mkdtemp(path.join(os.tmpdir(), "testrunner-"))
    let testFiles = await findTestFiles()
    console.log("test files:", testFiles)
    // TODO: maybe bundle all tests together
    let results = await Promise.all(testFiles.map((file) => runTestFile(file)))
    void results
    try {
        await fs.promises.rm(TEMPDIR, {recursive: true, force: true})
    } catch (e) {
        console.warn("failed to cleanup temporary directory: %s", TEMPDIR, e)
    }
}

let findTestFiles = async () => {
    let testFiles = []
    let walk = async (dir) => {
        let names = await fs.promises.readdir(dir)
        await Promise.all(
            names.map(async (name) => {
                if (IGNORE_DIRS.has(name)) {
                    return
                }
                let stat = await fs.promises.stat(path.join(dir, name))
                if (stat.isDirectory()) {
                    await walk(path.join(dir, name))
                } else if (stat.isFile()) {
                    if (TEST_PATTERN.test(name)) {
                        testFiles.push(path.join(dir, name))
                    }
                }
            }),
        )
    }
    await walk(process.cwd())
    return testFiles
}

let TMPFILES = {}
let runTestFile = async (file) => {
    console.log("run test file: %s", file)
    let name = path.basename(file, path.extname(file))
    let suffix = ""
    if (TMPFILES[name]) {
        suffix = "-" + TMPFILES[count]
    }
    TMPFILES[name] = TMPFILES[name] || 0
    TMPFILES[name]++

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

main()
