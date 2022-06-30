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

    let outdir = path.join(cwd, "dist")
    await fs.promises.rm(outdir, {
        recursive: true,
        force: true,
    })

    if (pkg.name.includes("figma")) {
        console.info("[build] %s", pkg.name)
        return buildFigmaPackage(cwd)
    }
    if (!pkg.main || !/\.(ts|tsx)$/.test(pkg.main)) {
        console.info(" [skip] %s", pkg.name)
        return
    }

    console.info("[build] %s", pkg.name)
    let external = Object.keys(pkg.dependencies || {})
    fs.rmSync(outdir, {recursive: true, force: true})
    let [result] = await Promise.all([
        esbuild.build({
            entryPoints: [path.join(cwd, pkg.main)],
            outfile: path.join(cwd, pkg.publishConfig.exports),
            bundle: true,
            platform: "node",
            format: "esm",
            external,
            metafile: true,
        }),
        esbuild.build({
            entryPoints: [path.join(cwd, pkg.main)],
            outfile: path.join(cwd, pkg.publishConfig.main),
            bundle: true,
            platform: "node",
            format: "cjs",
            external,
        }),
    ])
    if (verbose) {
        let text = await esbuild.analyzeMetafile(result.metafile)
        console.log(text)
    }
}

let buildFigmaPackage = async (cwd) => {
    let outdir = path.join(cwd, "dist")
    fs.rmSync(outdir, {recursive: true, force: true})
    await Promise.all([
        esbuild.build({
            entryPoints: [
                path.join(cwd, "plugin/plugin.tsx"),
                path.join(cwd, "ui/ui.tsx"),
            ],
            outdir,
            bundle: true,
            splitting: false,
            minify: true,
            platform: "node",
            format: "esm",
            define: {
                "process.env.NODE_ENV": JSON.stringify("production"),
            },
        }),
    ])

    let [ui, html] = await Promise.all([
        fs.promises.readFile(path.join(cwd, "dist/ui/ui.js"), "utf8"),
        fs.promises.readFile(path.join(cwd, "ui/ui.html"), "utf8"),
    ])
    html = html.replace("<script></script>", () => {
        return `<script>\n\t\t\t${ui}\t\t</script>`
    })
    await Promise.all([
        fs.promises.rm(path.join(cwd, "dist/ui/ui.js")),
        fs.promises.writeFile(path.join(cwd, "dist/ui/ui.html"), html, "utf8"),
    ])
}

const cwd = process.cwd()
if (cwd.includes("packages")) {
    buildPackage(cwd)
} else {
    main()
}
