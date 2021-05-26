import fs from "fs"
import cp from "child_process"
import path from "path"
import util from "util"

let main = async () => {
    let [cmd, ...args] = process.argv.slice(2)
    try {
        switch (cmd) {
            case "clean":
                await clean(args)
                break
            case "build":
                await build(args)
                break
        }
    } catch (e) {
        console.error("command '%s' failed:", cmd, e)
        process.exit(1)
    }
}


let clean = async () => {
    await Promise.all(
        packages().map(async (dir) => {
            let dist = path.join(dir, "dist")
            await fs.promises.rm(dist, {recursive: true, force: true})
            console.info("removed: %s", dist)
        }),
    )
}

let build = async () => {
    let spawn = util.promisify(cp.spawn)
    await spawn("yarn", ["tsc", "--build"], {
        stdio: "inherit",
    })
}

let packages = () => {
    return fs
        .readdirSync("packages")
        .map((dir) => path.join("packages", dir))
}

main()
