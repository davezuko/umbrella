import fs from "fs"
import cp from "child_process"
import path from "path"
import esbuild from "esbuild"

let verbose = process.argv.includes("--verbose")

let main = async () => {
    let packages = fs.readdirSync("packages")

    // remove all dist folders
    for (let name of packages) {
        fs.rmSync(path.join("packages", name, "dist"), {
            recursive: true,
            force: true,
        })
    }

    // build all packages
    for (let name of packages) {
        try {
            await buildPackage(name)
        } catch (e) {
            process.exit(1)
        }
    }

    // build type definitions
    console.info("generate .d.ts files...")
    cp.execSync("yarn tsc -b --force", {
        stdio: "inherit",
    })
}

let buildPackage = async (name) => {
    console.info("build package: %s", name)
    let cwd = path.join("packages", name)
    let pkg = JSON.parse(
        fs.readFileSync(path.join(cwd, "package.json"), "utf8"),
    )
    if (!pkg.source) {
        return
    }

    let outdir = path.join("packages", name, "dist")
    let external = Object.keys(pkg.dependencies || {})
    fs.rmSync(outdir, {recursive: true, force: true})
    let result = esbuild.buildSync({
        entryPoints: [path.join(cwd, pkg.source)],
        outfile: path.join(cwd, pkg.exports),
        bundle: true,
        platform: "node",
        format: "esm",
        external,
        metafile: true,
    })
    if (verbose) {
        let text = await esbuild.analyzeMetafile(result.metafile)
        console.log(text)
    }
    esbuild.buildSync({
        entryPoints: [path.join(cwd, pkg.source)],
        outfile: path.join(cwd, pkg.main),
        bundle: true,
        platform: "node",
        format: "cjs",
        external,
    })
}

main()
