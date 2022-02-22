import * as impl from "./cli_impl"

/**
 * Invokes the CLI with an array of args. Returns a numerical exit code.
 */
export let run = async (args: string[]): Promise<number> => {
    return impl.run(args)
}
