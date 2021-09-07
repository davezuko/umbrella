import {sprintf} from "sprintf-js"
import {registerTest} from "./runner"

type TestRunState = "idle" | "skipped" | "running" | "done"
type TestImpl = (t: TestUtil) => void

export const STOP_TEST = Symbol()

export let test = (name: string, fn: TestImpl) => {
    registerTest({name, impl: fn})
}

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
