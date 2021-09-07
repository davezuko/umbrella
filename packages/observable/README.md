# @davezuko/observable

Yet another observable library. What makes it different?

-   Only targets modern browsers.
-   API is designed for effective tree-shaking.

## Usage

### Simple Observables

```tsx
import {observable, autorun, transaction} from "@davezuko/observable"

let thing = observable({
    items: [],
})

// use autorun to run a function every time an observed value changes. Autorun
// will only watch observables that are accessed inside of that function.
autorun(() => {
    console.log("items.length = %s", thing.items.length)
})

thing.items.push(1) // logs "items.length = 1"
thing.items.push(2) // logs "items.length = 2"
```

### Classes

```tsx
import {extendObservable, transaction} from "@davezuko/observable"

class Thing {
    done: boolean

    constructor() {
        this.done = false
        extendObservable(this)
    }
}

let foo = new Thing()

autorun(() => {
    console.log("foo.done = %s", foo.done)
})
foo.done = true // logs "foo.done = true"
foo.done = false // logs "foo.done = false"
```

### Transactions

```tsx
import {extendObservable, transaction} from "@davezuko/observable"

class Thing {
    done: boolean

    constructor() {
        this.done = false
        extendObservable(this)
    }
}

let foo = new Thing()
let bar = new Thing()

// logs: "foo.done = false, bar.done = false"
autorun(() => {
    console.log("foo.done = %s, bar.done = %s", foo.done, bar.done)
})

// logs: "foo.done = true, bar.done = true" once the transaction completes.
// Note that no intermediate states are visible outside of the transaction,
// i.e. you won't see "foo.done = true, bar.done = false".
transaction(() => {
    foo.done = true
    bar.done = true
})
```

## Inspired by:

-   https://github.com/mobxjs/mobx
-   https://github.com/nx-js/observer-util
