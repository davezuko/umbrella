import * as api from "../api/api"

export let run = async (_osArgs: string[]): Promise<number> => {
    await api.run()
    return 0
}
