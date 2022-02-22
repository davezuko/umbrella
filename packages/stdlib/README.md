# @davezuko/stdlib

```ts
import {Result} from "@davezuko/stdlib"

interface ExampleData {
    thing: string
}
function example(): Result<ExampleData> {
    let success = true
    if (success) {
        return Result.ok({thing: "the thing"})
    } else {
        return Result.err("error description")
    }
}

let result = example()
if (result.ok) {
    console.log("got the thing: %s", result.value.thing)
} else {
    console.log("couldn't get the thing because: %s", result.error)
}
```
