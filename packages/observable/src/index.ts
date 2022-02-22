type Disposer = () => void

/**
 * Monitors observables that are accessed within fn, calling fn each time any
 * of those observables change. Returns a disposer function that will close
 * the subscription.
 */
export let autorun = (fn: () => void): Disposer => {
    fn()
    return () => {
        // TODO
    }
}

/**
 * Makes target's properties observable.
 */
export let extendObservable = <T>(_target: T) => {
    // @ts-expect-error
    return null as T
}

/**
 * Batches all observable changes made by fn such that they are only visible to
 * watchers once the transaction completes.
 */
export let transaction = (fn: () => void): void => {
    fn()
}
