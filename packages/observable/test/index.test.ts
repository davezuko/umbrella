import {test} from "@davezuko/testing"
import {extendObservable, autorun} from "@davezuko/observable"

test("extendObservable", (t) => {
    t.skip()
    class Thing {
        done: boolean
        constructor() {
            this.done = false
            extendObservable(this)
        }
    }

    let foo = new Thing()
    let calls = 0
    autorun(() => {
        calls++
        switch (calls) {
            case 1:
                // ignore, this is the setup call.
                break
            case 2: {
                let want = true
                if (foo.done !== want) {
                    t.error(
                        "call: %s; done = %s, want: %s",
                        calls,
                        foo.done,
                        want,
                    )
                }
                break
            }
            case 3: {
                let want = false
                if (foo.done !== want) {
                    t.error(
                        "call: %s; done = %s, want: %s",
                        calls,
                        foo.done,
                        want,
                    )
                }
                break
            }
            default:
                t.error("autorun called too many times: %s", calls)
        }
    })
    foo.done = true
    foo.done = false
})
