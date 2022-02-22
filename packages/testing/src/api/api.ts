import * as impl from "./api_impl"

export let test = (name: string, fn: TestFn) => {
    return impl.test(name, fn)
}

export let run = (): Promise<TestSuiteResult[]> => {
    return impl.run()
}

export let runFile = (path: string): Promise<TestSuiteResult> => {
    return impl.runFile(path)
}

export interface TestUtil {
    fail(): void
    failNow(): void
    skip(): void
    skipf(format: string, ...args: any[]): void
    log(message: string): void
    logf(format: string, ...args: any[]): void
    error(message: string): void
    errorf(format: string, ...args: any[]): void
    fatal(message: string): void
    fatalf(format: string, ...args: any[]): void
}

export interface Test {
    name: string
    func: TestFn
    result?: TestResult
}

export type TestFn = (t: TestUtil) => void

export interface TestResult {
    info: any
    logs: any[]
}

export interface TestSuite {
    file: string
    tests: Test[]
}

export type TestSuiteResult =
    | {
          type: "failed-to-run"
          suite: TestSuite
          message: string
      }
    | {
          type: "finished"
          suite: TestSuite
      }
