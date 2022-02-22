export type Result<T, E = Error> =
    | {ok: true; value: T; unwrap(): T}
    | {ok: false; error: E; unwrap(): T}

export let Result = {
    ok<T, E>(value: T): Result<T, E> {
        return new ResultOK(value)
    },
    err<T, E>(error: E): Result<T, E> {
        return new ResultErr(error)
    },
}

class ResultOK<T> {
    ok: true
    value: T

    constructor(value: T) {
        this.ok = true
        this.value = value
    }

    unwrap() {
        return this.value
    }
}

class ResultErr<E> {
    ok: false
    error: E

    constructor(error: E) {
        this.ok = false
        this.error = error
    }

    unwrap(): any {
        throw this.error
    }
}
