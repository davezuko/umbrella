import fs from "fs"
import cp from "child_process"
import path from "path"
import esbuild from "esbuild"

let verbose = process.argv.includes("--verbose")

let main = async () => {
    let packages = fs.readdirSync("packages")
    for (let name of packages) {
        try {
            const cwd = path.join("packages", name)
            await buildPackage(cwd)
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

let buildPackage = async (cwd) => {
    let pkg = JSON.parse(
        fs.readFileSync(path.join(cwd, "package.json"), "utf8"),
    )

    if (!pkg.main || !/\.(ts|tsx)$/.test(pkg.main)) {
        console.info(" [skip] %s", pkg.name)
        return
    }

    console.info("[build] %s", pkg.name)
    let outdir = path.join(cwd, "dist")
    await fs.promises.rm(outdir, {
        recursive: true,
        force: true,
    })

    let external = Object.keys(pkg.dependencies || {})
    fs.rmSync(outdir, {recursive: true, force: true})
    let result = esbuild.buildSync({
        entryPoints: [path.join(cwd, pkg.main)],
        outfile: path.join(cwd, pkg.publishConfig.exports),
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
        entryPoints: [path.join(cwd, pkg.main)],
        outfile: path.join(cwd, pkg.publishConfig.main),
        bundle: true,
        platform: "node",
        format: "cjs",
        external,
    })
}

const cwd = process.cwd()
if (cwd.includes("packages")) {
    buildPackage(cwd)
} else {
    main()
}
