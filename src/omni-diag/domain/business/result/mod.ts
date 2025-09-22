export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export class ResultPattern {
  private constructor() {}

  static ok<T, E = Error>(value: T): Result<T, E> {
    return { ok: true, value };
  }

  static err<T, E = Error>(error: E): Result<T, E> {
    return { ok: false, error };
  }

  static isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
    return result.ok === true;
  }

  static isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
    return result.ok === false;
  }

  static map<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => U
  ): Result<U, E> {
    if (this.isOk(result)) {
      return this.ok(fn(result.value));
    }
    return result;
  }

  static mapErr<T, E, F>(
    result: Result<T, E>,
    fn: (error: E) => F
  ): Result<T, F> {
    if (this.isErr(result)) {
      return this.err(fn(result.error));
    }
    return result;
  }

  static unwrap<T, E>(result: Result<T, E>): T {
    if (this.isOk(result)) {
      return result.value;
    }
    throw result.error;
  }

  static unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    if (this.isOk(result)) {
      return result.value;
    }
    return defaultValue;
  }

  static async fromPromise<T, E = Error>(
    promise: Promise<T>,
    errorMapper?: (error: unknown) => E
  ): Promise<Result<T, E>> {
    try {
      const value = await promise;
      return this.ok(value);
    } catch (error) {
      const mappedError = errorMapper ? errorMapper(error) : (error as E);
      return this.err(mappedError);
    }
  }
}