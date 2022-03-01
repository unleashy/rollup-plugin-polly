import { strict as assert } from "assert";

const undefWrapper = Symbol("option undefined wrapper");

export type Option<T> = T | undefined;

export function Some<T>(value: T): Option<T> {
  if (value === undefined) {
    throw TypeError("Option cannot hold an undefined");
  }

  return value;
}

export const None: Option<never> = undefined;

export const O = {
  match<T, R>(
    o: Option<T>,
    ifSome: (some: T) => R,
    ifNone: (none?: never) => R
  ): R {
    if (o !== undefined) {
      return ifSome(o);
    } else {
      return ifNone();
    }
  },

  then<T, U>(o: Option<T>, f: (some: T) => Option<U>): Option<U> {
    return O.match(
      o,
      some => f(some),
      none => None
    );
  },

  map<T, U>(o: Option<T>, f: (some: T) => U): Option<U> {
    return O.then(o, some => Some(f(some)));
  },

  filter<T>(o: Option<T>, f: (some: T) => boolean): Option<T> {
    return O.then(o, some => (f(some) ? o : None));
  },

  unwrap<T>(o: Option<T>): T {
    return O.match(
      o,
      some => some,
      none => assert.fail("tried to unwrap a None")
    );
  },

  unwrapOr<T extends U, U>(o: Option<T>, theDefault: () => U): U {
    return O.match(
      o,
      some => some,
      none => theDefault()
    );
  }
};
