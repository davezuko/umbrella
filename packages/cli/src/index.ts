export interface CLI {
    command(name: string, options: Partial<CommandOptions>): void
    run(args: string[]): Promise<number>
}

export interface CommandOptions {
    run(ctx: CLIContext, args: string[]): Promise<void> | void
}

export interface CLIContext {
    verbose: boolean
    logLevel: string
}

interface Command {
    name: string
    run(ctx: CLIContext, args: string[]): Promise<void> | void
}

export let createCLI = (): CLI => {
    let commands: Command[] = []
    return {
        command(name, options) {
            if (!options.run) {
                return
            }
            commands.push({
                name,
                run() {
                    throw new Error("not implemented")
                },
                ...options,
            })
        },
        async run(osArgs) {
            let commandName = ""
            let args: string[] = []
            let ctx: CLIContext = {
                verbose: false,
                logLevel: "",
            }
            for (let arg of osArgs) {
                if (arg === "--verbose") {
                    ctx.verbose = true
                    ctx.logLevel = "verbose"
                    continue
                }
                if (!commandName && arg[0] !== "-") {
                    commandName = arg
                    continue
                }
                args.push(arg)
            }
            try {
                let cmd = commands.find((c) => c.name === commandName)
                if (!cmd) {
                    console.error("unknown command: %s", commandName)
                    return 1
                }
                await cmd.run(ctx, args)
                return 0
            } catch (e) {
                // @ts-expect-error
                console.error(e.message)
                return 1
            }
        },
    }
}
