import {TestUtil} from "./index"

let TESTS: Test[] = []

interface Test {
    name: string
    impl: TestImpl
}

type TestImpl = (t: TestUtil) => void

export let registerTest = (test: Test): void => {
    TESTS.push(test)
}

Promise.resolve().then(() => {
    console.log("running tests: ", TESTS)
})
