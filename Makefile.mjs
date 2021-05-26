import fs from "fs"
import cp from "child_process"
import path from "path"
import util from "util"

let spawn = util.promisify(cp.spawn)

let main = async () => {
    let cmds = []
    let args = []
    for (let arg of process.argv.slice(2)) {
        if (arg[0] === "-") {
            args.push(arg)
        } else {
            cmds.push(arg)
        }
    }
    if (cmds.length === 0) {
        cmds = ["build"]
    }
    for (let cmd of cmds) {
        try {
            await run(cmd, args)
        } catch (e) {
            console.error("command '%s' failed:", cmd, e)
            process.exit(1)
        }
    }
}

let run = async (cmd, args) => {
    switch (cmd) {
        case "clean":
            await clean(args)
            break
        case "build":
            await build(args)
            break
        case "format":
            await format(args)
            break
        default:
            throw new Error("unknown command: " + cmd)
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

let build = async (args) => {
    await spawn("yarn", ["tsc", "--build", ...args], {
        stdio: "inherit",
    })
}

let format = async (args) => {
    if (!args.length) {
        args = ["--write"]
    }
    // TODO: inheriting stdio causes our process to exit when prettier finishes
    // need to fix this if we want to be able to chain commands
    await spawn("yarn", ["prettier", ".", "--no-color", ...args], {
        stdio: "inherit",
    })
}

let packages = () => {
    return fs.readdirSync("packages").map((dir) => path.join("packages", dir))
}

main()
